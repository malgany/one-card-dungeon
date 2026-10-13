import { startVitest } from 'vitest/node';
const v = await startVitest('test', process.argv.slice(2), {
  config:false, run:true, environment:'jsdom', setupFiles:['./tests/setup.js'],
  include:['tests/unit/**/*.test.js'], pool:'threads', maxWorkers:1, minWorkers:1,
  environmentOptions:{jsdom:{url:'http://localhost/'}},
}, { configFile:false, esbuild:false, resolve:{preserveSymlinks:true}, optimizeDeps:{noDiscovery:true,include:[]} });
await v.close();
