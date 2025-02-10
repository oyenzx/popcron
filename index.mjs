import fs from 'fs';
import * as web3 from '@solana/web3.js';
import fetch from 'node-fetch';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import prompt from 'prompt-sync';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Load proxies from file
function loadProxiesFromFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return data.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
        console.error('Error reading proxy file:', error);
        return [];
    }
}

const proxies = loadProxiesFromFile('proxies.txt');

function getRandomProxy() {
    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex];
}

const agent = new HttpsProxyAgent(getRandomProxy());

const { Keypair } = web3;

const url = 'https://tyrgts2xzb.execute-api.us-east-1.amazonaws.com/v1/auth/access_token';
const headers = {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'origin': 'https://www.sandwatch.ai',
    'referer': 'https://www.sandwatch.ai/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
};

async function generateAndSaveWallet() {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toString();
    const secretKey = bs58.encode(keypair.secretKey);

    return { publicKey, keypair };
}

async function signMessage(message, secretKey) {
    const messageBytes = new TextEncoder().encode(message);
    //console.log('Message (UTF-8):', Buffer.from(messageBytes).toString('utf-8'));

    const signature = nacl.sign.detached(messageBytes, secretKey);
    const signatureBase58 = bs58.encode(signature);

    //console.log('Signature (Base58):', signatureBase58);

    const isValid = nacl.sign.detached.verify(messageBytes, signature, secretKey.slice(32));
    console.log('\nSignature Valid?', isValid);

    return { signature: signatureBase58, isValid };
}

async function getToken(publicKey, signedMessage) {
    const payload = {
        publicKey,
        signedMessage
    };

    //console.log('Payload:', payload);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            agent
        });

        const data = await response.json();
        //console.log('API Response:', data);

        if (data.body) {
            const token = JSON.parse(data.body).token;
            console.log('Success Register..');
            console.log('Token:', token);

            return token;
        } else {
            console.error('No token received in response body.');
        }
    } catch (error) {
        console.error('Error fetching token:', error);
    }
    return null;
}

async function getSeatInfo(inviteCode) {
    const seatUrl = `https://tyrgts2xzb.execute-api.us-east-1.amazonaws.com/v1/seat/seat-for-invite-code/${inviteCode}`;

    try {
        const response = await fetch(seatUrl, {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'en-US,en;q=0.9',
                'origin': 'https://www.sandwatch.ai',
                'referer': 'https://www.sandwatch.ai/',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="102", "Google Chrome";v="102"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            },
            agent
        });

        const data = await response.json();
        //console.log('Seat Info Response:', data);

        if (data.statusCode === 200 && data.body) {
            const seatInfo = JSON.parse(data.body).seat;
            console.log('Seat Number:', seatInfo.seat_number);
            console.log('Seat Lottery Number:', seatInfo.seat_lottery_number);
            return seatInfo;
        } else {
            console.error('No seat information received in response body.');
        }
    } catch (error) {
        console.error('Error fetching seat information:', error);
    }
}

async function createProfileAndAssignSeat(userId, inviteCode, username, seatRow, seatNumber, lotteryTicket, token) {
    const createProfileUrl = 'https://tyrgts2xzb.execute-api.us-east-1.amazonaws.com/v1/user/create-profile-assign-seat';
    const payload = {
        user_id: userId,
        invite_code: inviteCode,
        username: username,
        seat_row: seatRow,
        seat_number: seatNumber,
        lottery_ticket: lotteryTicket
    };

    try {
        const response = await fetch(createProfileUrl, {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'content-type': 'application/json',
                'origin': 'https://www.sandwatch.ai',
                'referer': 'https://www.sandwatch.ai/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
            agent
        });

        const data = await response.json();
        console.log('Success Create Profile:', data);

        return data;
    } catch (error) {
        console.error('Error creating profile and assigning seat:', error);
    }
}

async function printProxyIpAddress() {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
        try {
            const response = await fetch('https://httpbin.org/ip', { agent });
            const data = await response.json();
            console.log('IP Address Proxy :', data.origin);
            return;
        } catch (error) {
            console.error('Error fetching proxy IP address:', error);
            retryCount++;
            if (retryCount < maxRetries) {
                console.log(`Retrying... (${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    console.error('Failed to fetch proxy IP address after', maxRetries, 'retries.');
}

(async () => {
    console.log(`==============================`);
    console.log(`  Sandwatch.ai Auto Referral  `);
    console.log(`    By: @AirdropFamilyIDN     `);
    console.log(`==============================`);

    const getInput = prompt();
    const inviteCode = getInput('Masukkan kode Referral (contoh: F90DA5): ');
    const iteration = parseInt(getInput('Mau berapa referral bosku?: '));

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < iteration; i++) {
        try {
            const { publicKey, keypair } = await generateAndSaveWallet();

            const message = "Log in to Sandwatch";
            const { signature, isValid } = await signMessage(message, keypair.secretKey);

            if (!isValid) {
                console.error('Invalid signature, aborting API call.');
                failedCount++;
                continue;
            }

            const token = await getToken(publicKey, signature);
            if (!token) {
                console.error('Failed to retrieve token.');
                failedCount++;
                continue;
            }

            await printProxyIpAddress();

            const seatInfo = await getSeatInfo(inviteCode);
            if (!seatInfo) {
                console.error('Failed to retrieve seat information.');
                failedCount++;
                continue;
            }

            const userId = publicKey;
            const randomNumbers = Math.floor(100 + Math.random() * 900);
            const username = `user_${Math.random().toString(36).substring(7)}${randomNumbers}`;
            const seatRow = "T";
            const seatNumber = seatInfo.seat_number;
            const lotteryTicket = seatInfo.seat_lottery_number;

            await createProfileAndAssignSeat(userId, inviteCode, username, seatRow, seatNumber, lotteryTicket, token);
            successCount++;

            if (successCount > 0) {
                const walletInfo = `Address: ${publicKey}\nPrivateKey: ${bs58.encode(keypair.secretKey)}\n`;
                fs.writeFileSync(
                    'solana_wallet.txt',
                    walletInfo,
                    { flag: 'a' }
                );
            }
        } catch (error) {
            console.error('Error during execution:', error);
            failedCount++;
        }

        if (i < iteration - 1) {
            console.log(`Proses ${i + 1}/${iteration} selesai, tunggu 10 detik untuk Proses selanjutnya...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }

    console.log(`\nReferral sukses: ${successCount}`);
    console.log(`Referral gagal : ${failedCount}`);
})();
