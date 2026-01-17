/**
 * Socket.io 轮询代理
 * 通过 HTTP 轮询代理 Socket.io 请求，解决 HTTPS 混合内容问题
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = 'http://83.229.126.150:3001'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString()
  const url = `${BACKEND_URL}/socket.io/${searchParams ? `?${searchParams}` : ''}`

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const data = await response.json()
      return NextResponse.json(data, { status: response.status })
    } else {
      const text = await response.text()
      return new NextResponse(text, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
        },
      })
    }
  } catch (error) {
    console.error('[Socket.io Proxy] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 502 }
    )
  }
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString()
  const url = `${BACKEND_URL}/socket.io/${searchParams ? `?${searchParams}` : ''}`

  try {
    const body = await request.text()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body,
    })

    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
      },
    })
  } catch (error) {
    console.error('[Socket.io Proxy] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 502 }
    )
  }
}
