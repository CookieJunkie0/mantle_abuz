const chalk = require('chalk');
const fs = require('fs');
const dotenv = require('dotenv').config({ path: './.env' });

const clearLastLine = () => {
    process.stdout.moveCursor(0, -1) // up one line
    process.stdout.clearLine(1) // from cursor to end
}

const timeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class Logger {

    constructor(saveLogs, savePath) {
        this.saveLogs = saveLogs;
        this.savePath = savePath? savePath : './logs.txt';
    }

    info(msg) {
        console.log(`[${new Date().toLocaleTimeString()}] | ${chalk.bold.blue('INFO')} | ` + msg);
        if(this.saveLogs) fs.appendFileSync(this.savePath, `${`[${new Date().toLocaleTimeString()}] | INFO | ` + msg}\n`);
    }
    
    error(msg) {
        console.log(`[${new Date().toLocaleTimeString()}] | ${chalk.bold.red('ERROR')} | ` + msg);
        if(this.saveLogs) {fs.appendFileSync(this.savePath, `${`[${new Date().toLocaleTimeString()}] | ERROR | ` + msg}\n`)};
    }
    
    warn(msg) {
        console.log(`[${new Date().toLocaleTimeString()}] | ${chalk.bold.yellow('WARN')} | ` + msg);
        if(this.saveLogs) {fs.appendFileSync(this.savePath, `${`[${new Date().toLocaleTimeString()}] | WARN | ` + msg}\n`)};
    }
    
    success(msg) {
        console.log(`[${new Date().toLocaleTimeString()}] | ${chalk.bold.green('SUCCESS')} | ` + msg);
        if(this.saveLogs) fs.appendFileSync(this.savePath, `${`[${new Date().toLocaleTimeString()}] | SUCCESS | ` + msg}\n`);
    }

    async setTimer(seconds, msg) {
        try {
            let timer = 0;

    
            while(timer < seconds+1) {
                if(timer != 0) clearLastLine();
                console.log(`[${new Date().toLocaleTimeString()}] | ${chalk.bold.cyan('TIMER')} | Waiting ${timer}/${seconds} ${msg}`);
                await timeout(1000);
                timer++;
            }
    
            return timer;
        } catch(e) { console.log(e) }
    }
}

module.exports = {
    Logger
}