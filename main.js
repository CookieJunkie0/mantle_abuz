require('dotenv').config({path: __dirname + '/.env'});
const ethers = require('ethers');
const axios = require('axios');
const fs = require('fs');
const { ATESTATOR_ABI } = require('./abis');
const { shuffle } = require('./helper');

const MIX_WALLETS = JSON.parse(process.env.MIX_WALLETS);
const MANTLE_PROVIDER = new ethers.providers.JsonRpcProvider(process.env.MANTLE_RPC);

async function getAttestationData(wallet) {
    try {
        const response = await axios.post("https://gateway.clique.social/sbt-signer/attestor/64c9cd892fce35a476860fb5/signature", 
        { walletAddress: wallet });

        if(response.status === 200) {
            return {success: true, sig: response.data.signature, url: response.data.attestationUrl};
        } else { return { success:false } }
    } catch(e) {return {success: false, err: e}}
}

getAttestationData("0xD253d1275008257AD21A48546f710DC7Ca8f378b").then(console.log)

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