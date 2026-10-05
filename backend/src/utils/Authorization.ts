interface AuthCookie {
  Authorization?: string;
}

function Authorization(cookie: string): string | undefined {
  if (!cookie) return undefined;
  const cookieObject = cookie.split('; ').reduce((acc: Record<string, string>, item: string) => {
    const [key, ...rest] = item.split('=');
    acc[key] = rest.join('=');
    return acc;
  }, {});

  return cookieObject['Authorization'];
}

export { Authorization };
