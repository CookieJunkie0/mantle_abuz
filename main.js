require('dotenv').config({path: __dirname + '/.env'});
const ua = require('user-agents');
const ethers = require('ethers');
const axios = require('axios');
const fs = require('fs');
const {HttpsProxyAgent} = require('https-proxy-agent');
const { ATESTATOR_ABI } = require('./modules/abis');
const { shuffle, timeout } = require('./modules/helper');
const { Logger } = require('./modules/logger');
const chalk = require('chalk');

const logger = new Logger(true, __dirname + '/output/logs.txt');

const PROXY = process.env.PROXY;
const PROXY_ROTATION_LINK = process.env.PROXY_ROTATION_LINK;
const ROTATION_TIMEOUT = process.env.ROTATION_TIMEOUT * 1000;
const INVITE_CODE = process.env.INVITE_CODE;
const MIX_WALLETS = JSON.parse(process.env.MIX_WALLETS);
const MANTLE_PROVIDER = new ethers.providers.JsonRpcProvider(process.env.MANTLE_RPC);

async function changeProxy() {
    try {
        const response = await axios.get(PROXY_ROTATION_LINK);
        await timeout(ROTATION_TIMEOUT);

        return {success: true};
    
    } catch(e) { return { success: false, err: e } }
}

async function getSignatureMessage(axiosBody, wallet) {
    try {
        const response = await axiosBody.get(`https://mdi-quests-api-production.up.railway.app/auth/web3/signature?address=${wallet}`);

        return {success: true, msg: response.data.message};
    } catch(e) { return { success: false, err: e } }
}

async function register(axiosBody, account, inviteCode) {
    try {
        const sigMessage = await getSignatureMessage(axiosBody, account.address);
        if(!sigMessage.success) return sigMessage;
        const sig = await account.signMessage(sigMessage.msg);

        const response = await axiosBody.post(`https://mdi-quests-api-production.up.railway.app/auth/web3/login`, {
            address: account.address,
            inviteCode: inviteCode,
            signature: sig,
            walletType: "metamask"
        });

        const refResponse = await axiosBody.post(`https://mdi-quests-api-production.up.railway.app/referral/set-referrer`, { inviteCode: inviteCode }, {
            headers: {
                "Mdi-Jwt": `${response.data.web3Token}`
            }
        });

        return {success: true, inviteCode: refResponse.data.inviteCode};
    } catch(e) {console.log(e);  return { success: false, err: e } }
}

async function getAttestationData(axiosBody, wallet) {
    try {
        const response = await axiosBody.post("https://gateway.clique.social/sbt-signer/attestor/64c9cd892fce35a476860fb5/signature", 
        { walletAddress: wallet });
        
        return {success: true, sig: response.data.signature, url: response.data.attestationUrl};
    } catch(e) {return {success: false, err: e}}
}

async function mintAtestat(axiosBody, account) {
    try {
        const signer = account.connect(MANTLE_PROVIDER);
        const contract = new ethers.Contract("0x7C78b18F496d3D37c44De09da4a5a76Eb34B7e74", ATESTATOR_ABI, signer);
        
        const attData = await getAttestationData(axiosBody, account.address);
        if(!attData.success) return attData;

        const tx = await contract.mintMJ(account.address, '1', '0', '', attData.url, attData.sig, {value: ethers.utils.parseEther('0.2')});
        const receipt = await tx.wait();

        if(receipt.status !== 1) { return {success: false, err: "TX failed", hash: receipt.transactionHash} }
        return {success: true, hash: receipt.transactionHash};
    } catch(e) {return {success: false, err: e}}  
}

async function confirmMint(axiosBody, account, hash) {
    try {
        const response = await axiosBody.post("https://gateway.clique.social/sbt-signer/attestor/64c9cd892fce35a476860fb5/entry", 
            {"walletAddress": account.address,"additionalInformation": {"txHash": hash}}
        );
        
        return {success: true};
    } catch(e) { return { success: false, err: e } }
}
async function main() {
    let wallets = fs.readFileSync(__dirname + '/wallets.txt', 'utf8').split('\n');

    console.log(chalk.bold.blueBright('Mantle Abuze software by https://t.me/cookiejunkieeth'));    
    logger.info(`Starting with ${wallets.length} wallets`);

    MIX_WALLETS? wallets = shuffle(wallets) : '';

    for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        const account = new ethers.Wallet(wallet, MANTLE_PROVIDER);

        if(PROXY) {
            const rotation = await changeProxy();
            if(!rotation.success) { logger.error(`${account.address} | ${rotation.err}` ); continue};
        }

        const [proxyHost, proxyPort, proxyUser, proxyPass] = PROXY? PROXY.split(':') : '';
        const axiosBody = PROXY? axios.create({
            headers: {"User-Agent": new ua({deviceCategory: 'desktop'}).random()},
            httpsAgent: new HttpsProxyAgent({host: proxyHost, port: proxyPort, username: proxyUser, password: proxyPass})
        }) : axios.create({
            headers: {"User-Agent": new ua({deviceCategory: 'desktop'}).random()}
        });

        logger.info(`${account.address} | Registering account [${i+1}/${wallets.length}] with ${INVITE_CODE}`);

        const reg = await register(axiosBody, account, INVITE_CODE);
        if(!reg.success) { logger.error(`${account.address} | ${reg.err}` ); continue};

        logger.success(`${account.address} | Account registered - minting attestatate...`);

        const mint = await mintAtestat(axiosBody, account);
        if(!mint.success) { logger.error(`${account.address} | ${mint.err}` ); continue};

        logger.success(`${account.address} | Attestat minted, confirming for mantle - ${mint.hash}`);

        const confirm = await confirmMint(axiosBody, account, mint.hash);
        if(!confirm.success) { logger.error(`${account.address} | ${confirm.err}` ); continue};

        fs.appendFileSync(__dirname + '/output/registered.txt', `${wallet}:${reg.inviteCode}\n`);
        logger.success(`${account.address} | DONE`);
    }
}

main()