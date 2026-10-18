import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
 reactStrictMode:true,
 poweredByHeader:false,
 async headers(){return [{source:'/:path*',headers:[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
  // Restrict framing/objects without guessing SDK script allowlists or blocking wallets.
  {key:'Content-Security-Policy',value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'"}
 ]},{source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]}];}
};
export default nextConfig;
