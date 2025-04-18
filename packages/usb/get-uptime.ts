#!/usr/bin/env -S node --loader ts-node/esm --no-warnings=ExperimentalWarning

import Uhk, { errorHandler, yargs } from './src/index.js';

(async function () {
    try {
        const argv = yargs
            .usage('Get uptime')
            .argv;

        const { operations } = Uhk(argv);

        const uptime = await operations.getUptime();
        console.log(`uptime: ${uptime.days}d ${uptime.hours.toString(10).padStart(2, '')}:${uptime.minutes.toString(10).padStart(2, '')}:${uptime.seconds.toString(10).padStart(2, '')}`);
    } catch (error) {
        await errorHandler(error);
    }
})();
