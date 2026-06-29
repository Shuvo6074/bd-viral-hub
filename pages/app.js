import { useEffect } from "react";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (document.querySelector('script[src*="5c5fa829d1b2adb187a491231ec4716f"]')) return;
    const s = document.createElement('script');
    s.src = 'https://pl29731011.effectivecpmnetwork.com/5c/5f/a8/5c5fa829d1b2adb187a491231ec4716f.js';
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return <Component {...pageProps} />;
}
