import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.replace('#', ''));
      let attempts = 0;
      const maxAttempts = 30;
      let cancelled = false;
      let timeoutId = null;

      const scrollToElement = () => {
        if (cancelled) return true;
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          return true;
        }
        return false;
      };

      if (!scrollToElement()) {
        const retryScroll = () => {
          attempts++;
          if (cancelled) return;
          if (scrollToElement()) return;
          if (attempts >= maxAttempts) {
            window.scrollTo(0, 0);
            return;
          }
          timeoutId = setTimeout(retryScroll, 100);
        };
        requestAnimationFrame(retryScroll);
      }

      return () => {
        cancelled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
}
