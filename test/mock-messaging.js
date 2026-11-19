export const isSupported=async()=>true; export const getMessaging=()=>({});
// one address per browser, like the real thing (it only changes now and then)
export const getToken=async()=>{ let t=localStorage.getItem('mocktoken'); if(!t){ t='tok-'+Math.random().toString(36).slice(2,8); localStorage.setItem('mocktoken',t); } return t; };
