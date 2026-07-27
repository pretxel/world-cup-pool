import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return NextResponse.redirect("https://winscore.me/", 308);
}

export const config = {
  matcher: "/:path*",
};
