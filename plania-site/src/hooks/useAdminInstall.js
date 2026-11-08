import { useEffect } from 'react';

const ADMIN_ICON = 'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/69c9d343d_logo.png';

function upsert(selector, create) {
  let node = document.head.querySelector(selector);
  const existed = Boolean(node);
  if (!node) {
    node = create();
    document.head.appendChild(node);
  }
  return { node, existed };
}

// While the admin page is open it presents itself as its own app, so "Add to home
// screen" saves the admin and not the public site (which uses a start_url of "/").
export default function useAdminInstall() {
  useEffect(() => {
    const restore = [];
    const setAttr = (selector, create, attr, value) => {
      const { node, existed } = upsert(selector, create);
      const previous = node.getAttribute(attr);
      node.setAttribute(attr, value);
      restore.push(() => {
        if (existed) {
          if (previous === null) node.removeAttribute(attr);
          else node.setAttribute(attr, previous);
        } else {
          node.remove();
        }
      });
    };

    const make = (tag, attrs) => () => {
      const node = document.createElement(tag);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
      return node;
    };

    setAttr('link[rel="manifest"]', make('link', { rel: 'manifest' }), 'href', '/admin-manifest.json');
    setAttr('link[rel="apple-touch-icon"]', make('link', { rel: 'apple-touch-icon' }), 'href', ADMIN_ICON);
    setAttr(
      'meta[name="apple-mobile-web-app-title"]',
      make('meta', { name: 'apple-mobile-web-app-title' }),
      'content',
      'ניהול'
    );
    setAttr(
      'meta[name="apple-mobile-web-app-capable"]',
      make('meta', { name: 'apple-mobile-web-app-capable' }),
      'content',
      'yes'
    );
    setAttr('meta[name="mobile-web-app-capable"]', make('meta', { name: 'mobile-web-app-capable' }), 'content', 'yes');
    setAttr('meta[name="theme-color"]', make('meta', { name: 'theme-color' }), 'content', '#5E1D1D');

    const previousTitle = document.title;
    document.title = 'ניהול · Plania’s';

    return () => {
      restore.forEach((fn) => fn());
      document.title = previousTitle;
    };
  }, []);
}
