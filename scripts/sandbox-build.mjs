import { build } from 'vite';
await build({ configFile:false, esbuild:false, resolve:{preserveSymlinks:true}, build:{minify:false,cssMinify:false}, optimizeDeps:{noDiscovery:true,include:[]},
  plugins:[{name:'restricted-environment-defines',enforce:'pre',transform(code,id){
    if (!id.includes('/node_modules/') && id.endsWith('.js')) return code.replaceAll('import.meta.env','({BASE_URL:"/",VITE_ONE_RPG_DEBUG:"false"})').replaceAll('import.meta.hot','undefined');
  }}],
});
