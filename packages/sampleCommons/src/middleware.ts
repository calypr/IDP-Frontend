import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

async function proxyRequest(request: NextRequest, destinationUrl: string) {
  console.log('4. Proxying to:', destinationUrl);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    headers.set(key, value);
  });
  headers.set('Host', 'cbds-dev.ohsu.edu');

  // _----------------------------- PASTE TOKEN HERE ----------------------------_ //
  headers.set(
    'Cookie',
    'csrftoken=; visitor=; fence=; access_token=; session=',
  );
  // ---------------------------------------------------------------------------- //
  console.log('6. Request headers:', Object.fromEntries(headers));
  try {
    const response = await fetch(destinationUrl, {
      method: request.method,
      headers: headers,
      body: request.body ? request.body : undefined,
      redirect: 'manual',
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': 'https://caliper-training.ohsu.edu:3000',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function middleware(request: NextRequest) {
  const baseDestination = 'https://cbds-dev.ohsu.edu';
  const forwardedHost =
    request.headers.get('x-forwarded-host') || 'localhost:3000';
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'http';
  const clientUrl = `${forwardedProto}://${forwardedHost}${request.nextUrl.pathname}${request.nextUrl.search}`;

  console.log('1. Middleware triggered for:', clientUrl);
  console.log('2. Pathname:', request.nextUrl.pathname);

  if (
    request.nextUrl.pathname.startsWith('/user/') ||
    request.nextUrl.pathname.startsWith('/auth/') ||
    request.nextUrl.pathname.startsWith('/_status') ||
    request.nextUrl.pathname.startsWith('/authz/') ||
    request.nextUrl.pathname.startsWith('/ExplorerConfig/') ||
    request.nextUrl.pathname.startsWith('/guppy/') ||
    request.nextUrl.pathname.startsWith('/grip/')
  ) {
    const destinationUrl = `${baseDestination}${request.nextUrl.pathname}`;
    return proxyRequest(request, destinationUrl);
  }

  console.log('3. Passing through to Next.js');
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/user/:path*',
    '/auth/:path*',
    '/_status/:path*',
    '/grip/:path*',
    '/guppy/:path*',
    '/authz/:path*',
    '/ExplorerConfig/:path*',
  ],
};
