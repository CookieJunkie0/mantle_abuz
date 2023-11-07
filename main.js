require('dotenv').config({path: __dirname + '/.env'});
const ethers = require('ethers');
const axios = require('axios');
const fs = require('fs');
const { ATESTATOR_ABI } = require('./modules/abis');
const { shuffle } = require('./modules/helper');
const { Logger } = require('./modules/logger');
const { log } = require('console');

const logger = new Logger(true, __dirname + '/output/logs.txt');

const INVITE_CODE = process.env.INVITE_CODE;
const MIX_WALLETS = JSON.parse(process.env.MIX_WALLETS);
const MANTLE_PROVIDER = new ethers.providers.JsonRpcProvider(process.env.MANTLE_RPC);

async function getSignatureMessage(wallet) {
    try {
        const response = await axios.get(`https://mdi-quests-api-production.up.railway.app/auth/web3/signature?address=${wallet}`);

        return {success: true, msg: response.data.message};
    } catch(e) { return { success: false, err: e } }
}

async function register(account, inviteCode) {
    try {
        const sigMessage = await getSignatureMessage(account.address);
        const sig = await account.signMessage(sigMessage.msg);

        const response = await axios.post(`https://mdi-quests-api-production.up.railway.app/auth/web3/login`, {
            address: account.address,
            inviteCode: inviteCode,
            signature: sig,
            walletType: "metamask"
        });

        const refResponse = await axios.post(`https://mdi-quests-api-production.up.railway.app/referral/set-referrer`, { inviteCode: inviteCode }, {
            headers: {
                "Mdi-Jwt": `${response.data.web3Token}`
            }
        });

        return {success: true, inviteCode: refResponse.data.inviteCode};
    } catch(e) { return { success: false, err: e } }
}

async function getAttestationData(wallet) {
    try {
        const response = await axios.post("https://gateway.clique.social/sbt-signer/attestor/64c9cd892fce35a476860fb5/signature", 
        { walletAddress: wallet });
        
        return {success: true, sig: response.data.signature, url: response.data.attestationUrl};
    } catch(e) {return {success: false, err: e}}
}

async function mintAtestat(account) {
    try {
        const signer = account.connect(MANTLE_PROVIDER);
        const contract = new ethers.Contract("0x7C78b18F496d3D37c44De09da4a5a76Eb34B7e74", ATESTATOR_ABI, signer);
        
        const attData = await getAttestationData(account.address);
        if(!attData.success) return attData;

        const tx = await contract.mintMJ(account.address, '1', '0', '', attData.url, attData.sig, {value: ethers.utils.parseEther('0.2')});
        const receipt = await tx.wait();

        if(receipt.status !== 1) { return {success: false, err: "TX failed", hash: receipt.transactionHash} }
        return {success: true, hash: receipt.transactionHash};
    } catch(e) {return {success: false, err: e}}  
}

async function confirmMint(account, hash) {
    try {
        const response = await axios.post("https://gateway.clique.social/sbt-signer/attestor/64c9cd892fce35a476860fb5/entry", 
            {"walletAddress": account.address,"additionalInformation": {"txHash": hash}}
        );
        
        return {success: true};
    } catch(e) { return { success: false, err: e } }
}
async function main() {

    let wallets = fs.readFileSync(__dirname + '/wallets.txt', 'utf8').split('\n');

    logger.info(`Starting with ${wallets.length} wallets`);

    MIX_WALLETS? wallets = shuffle(wallets) : '';

    for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        const account = new ethers.Wallet(wallet, MANTLE_PROVIDER);

        logger.info(`${account.address} | Registering account [${i+1}/${wallets.length}] with ${INVITE_CODE}`);

        const reg = await register(account, INVITE_CODE);
        if(!reg.success) { logger.error(`${account.address} | ${reg.err}` ); continue};

        logger.success(`${account.address} | Account registered - minting attestatate...`);

        const mint = await mintAtestat(account);
        if(!mint.success) { logger.error(`${account.address} | ${mint.err}` ); continue};

        logger.success(`${account.address} | Attestat minted, confirming for mantle - ${mint.hash}`);

        const confirm = await confirmMint(account, mint.hash);
        if(!confirm.success) { logger.error(`${account.address} | ${confirm.err}` ); continue};

        fs.appendFileSync(__dirname + '/output/registered.txt', `${wallet}:${reg.inviteCode}\n`);
        logger.success(`${account.address} | DONE`);
    }
}

main()