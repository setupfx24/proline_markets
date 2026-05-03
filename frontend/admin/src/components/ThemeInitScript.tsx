import Script from 'next/script';

const INIT = `
(function(){
  try {
    var d=document.documentElement;
    var raw = localStorage.getItem('admin-theme');
    var t='dark';
    if(raw){var p=JSON.parse(raw);t=(p&&p.state&&p.state.theme)||'dark';}
    if(t==='light'){
      d.classList.add('light');d.classList.remove('dark');
      d.style.backgroundColor='#f2efe9';d.style.color='#141414';
    }else{
      d.classList.add('dark');d.classList.remove('light');
      d.style.backgroundColor='#050707';d.style.color='#f0f0f0';
    }
  } catch(e){
    document.documentElement.classList.add('dark');
    document.documentElement.style.backgroundColor='#050707';
  }
})();
`;

/** Runs before paint to match persisted theme (zustand persist key: admin-theme). */
export default function ThemeInitScript() {
  return <Script id="admin-theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: INIT }} />;
}
