/**
 * API 代理路由
 * 解决 HTTPS 前端无法请求 HTTP 后端的混合内容问题
 */

import { NextRequest, NextResponse } from 'next/server'

// 后端服务器地址
const BACKEND_URL = 'http://83.229.126.150:3001'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const targetPath = path.join('/')
  const searchParams = request.nextUrl.searchParams.toString()
  const url = `${BACKEND_URL}/api/${targetPath}${searchParams ? `?${searchParams}` : ''}`

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[API Proxy] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from backend' },
      { status: 502 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const targetPath = path.join('/')
  const url = `${BACKEND_URL}/api/${targetPath}`

  try {
    const body = await request.json()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[API Proxy] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from backend' },
      { status: 502 }
    )
  }
}
