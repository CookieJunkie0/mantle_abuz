require('dotenv').config({path: __dirname + '/.env'});
const ethers = require('ethers');
const axios = require('axios');
const fs = require('fs');
const { ATESTATOR_ABI } = require('./abis');
const { shuffle } = require('./helper');

const MIX_WALLETS = JSON.parse(process.env.MIX_WALLETS);
const MANTLE_PROVIDER = new ethers.providers.JsonRpcProvider(process.env.MANTLE_RPC);

async function getSignatureMessage(wallet) {
    try {
        const response = await axios.get(`https://mdi-quests-api-production.up.railway.app/auth/web3/signature?address=${wallet}`);

        if(response.status !== 200) {
            return {success: false, err: response.data};
        }
        
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

        if(response.status !== 201) {
            return {success: false, err: response.data};
        }

        const refResponse = await axios.post(`https://mdi-quests-api-production.up.railway.app/referral/set-referrer`, { inviteCode: inviteCode }, {
            headers: {
                "Mdi-Jwt": `${response.data.web3Token}`
            }
        });

        if(refResponse.status !== 200) {
            return {success: false, err: refResponse.data};
        }

        return {success: true};
    } catch(e) { return { success: false, err: e } }
}

async function getAttestationData(wallet) {
    try {
        const response = await axios.post("https://gateway.clique.social/sbt-signer/attestor/64c9cd892fce35a476860fb5/signature", 
        { walletAddress: wallet });

        if(response.status !== 200) {
            return {success: false, err: response.data};
        }
        
        return {success: true, sig: response.data.signature, url: response.data.attestationUrl};
    } catch(e) {return {success: false, err: e}}
}

async function mintAtestat(account) {
    try {
        const contract = new ethers.Contract("0x7C78b18F496d3D37c44De09da4a5a76Eb34B7e74", ATESTATOR_ABI, signer);
        const signer = account.connect(MANTLE_PROVIDER);    
        
        const attData = await getAttestationData(account.address);
        if(!attData.success) return attData;

        const tx = await contract.mintMJ(account.address, 1, 0, '', attData.url, attData.sig);
        const receipt = await tx.wait();

        if(receipt.status !== 1) { return {success: false, err: "TX failed", hash: receipt.transactionHash} }
        return {success: true, hash: receipt.transactionHash};
    } catch(e) {return {success: false, err: e}}  
}

async function main() {

    let wallets = fs.readFileSync(__dirname + '/wallets.txt', 'utf8').split('\n');

    MIX_WALLETS? wallets = shuffle(wallets) : '';

    for (const wallet of wallets) {
        const account = new ethers.Wallet(wallet, MANTLE_PROVIDER);
        const mint = await mintAtestat(account);
    }
}

register(new ethers.Wallet('0xf2b8983149fea6233bbbe08a5a927339808b6049de1ec034c6566d90615d59b5'), 'A9GRX1JPAI').then(console.log)