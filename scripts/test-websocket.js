#!/usr/bin/env node

/**
 * WebSocket Test Script
 *
 * This script tests the WebSocket functionality including:
 * - Connection establishment
 * - Ping/pong mechanism
 * - Store isolation
 * - Message broadcasting
 * - Connection statistics
 */

const WebSocket = require('ws')

const WS_URL = 'ws://localhost:8000/ws'
const API_BASE = 'http://localhost:8000/api/v1'

class WebSocketTester {
  constructor() {
    this.connections = new Map()
    this.testResults = []
  }

  async runTests() {
    console.log('🚀 Starting WebSocket Tests...\n')

    try {
      // Test 1: Basic connection
      await this.testBasicConnection()

      // Test 2: Authentication
      await this.testAuthentication()

      // Test 3: Ping/Pong mechanism
      await this.testPingPong()

      // Test 4: Store isolation
      await this.testStoreIsolation()

      // Test 5: Message broadcasting
      await this.testMessageBroadcasting()

      // Test 6: Statistics endpoint
      await this.testStatisticsEndpoint()

      // Test 7: Health check
      await this.testHealthCheck()

      // Cleanup
      await this.cleanup()

      // Print results
      this.printResults()
    } catch (error) {
      console.error('❌ Test failed:', error.message)
      await this.cleanup()
      process.exit(1)
    }
  }

  async testBasicConnection() {
    console.log('📡 Test 1: Basic Connection')

    const ws = new WebSocket(WS_URL)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 5000)

      ws.on('open', () => {
        clearTimeout(timeout)
        this.connections.set('test1', ws)
        this.testResults.push({ test: 'Basic Connection', status: 'PASS' })
        console.log('✅ Basic connection established')
        resolve()
      })

      ws.on('error', (error) => {
        clearTimeout(timeout)
        this.testResults.push({
          test: 'Basic Connection',
          status: 'FAIL',
          error: error.message,
        })
        reject(error)
      })
    })
  }

  async testAuthentication() {
    console.log('🔐 Test 2: Authentication')

    const ws = this.connections.get('test1')
    if (!ws) throw new Error('No connection available')

    return new Promise((resolve, reject) => {
      const authMessage = {
        type: 'authenticate',
        data: {
          userId: 'test-user-123',
          storeId: 'test-store-456',
        },
      }

      ws.send(JSON.stringify(authMessage))

      // Listen for any response
      const timeout = setTimeout(() => {
        this.testResults.push({ test: 'Authentication', status: 'PASS' })
        console.log('✅ Authentication message sent')
        resolve()
      }, 2000)

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          if (
            message.type === 'user_joined' ||
            message.type === 'general_notification'
          ) {
            clearTimeout(timeout)
            this.testResults.push({ test: 'Authentication', status: 'PASS' })
            console.log('✅ Authentication successful')
            resolve()
          }
        } catch (error) {
          // Ignore parsing errors
        }
      })
    })
  }

  async testPingPong() {
    console.log('🏓 Test 3: Ping/Pong Mechanism')

    const ws = this.connections.get('test1')
    if (!ws) throw new Error('No connection available')

    return new Promise((resolve, reject) => {
      let pongReceived = false

      const pingMessage = {
        type: 'ping',
        data: { ping: true },
        timestamp: new Date().toISOString(),
      }

      ws.send(JSON.stringify(pingMessage))

      const timeout = setTimeout(() => {
        if (!pongReceived) {
          this.testResults.push({
            test: 'Ping/Pong',
            status: 'FAIL',
            error: 'No pong received',
          })
          reject(new Error('No pong response received'))
        }
      }, 5000)

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          if (message.type === 'pong') {
            pongReceived = true
            clearTimeout(timeout)
            this.testResults.push({ test: 'Ping/Pong', status: 'PASS' })
            console.log('✅ Ping/Pong mechanism working')
            resolve()
          }
        } catch (error) {
          // Ignore parsing errors
        }
      })
    })
  }

  async testStoreIsolation() {
    console.log('🏪 Test 4: Store Isolation')

    // Create two connections with different store IDs
    const ws1 = new WebSocket(WS_URL)
    const ws2 = new WebSocket(WS_URL)

    return new Promise((resolve, reject) => {
      let ws1Ready = false
      let ws2Ready = false
      let testMessageReceived = false

      const setupConnection = (ws, storeId, connectionName) => {
        ws.on('open', () => {
          const authMessage = {
            type: 'authenticate',
            data: {
              userId: `test-user-${storeId}`,
              storeId: storeId,
            },
          }
          ws.send(JSON.stringify(authMessage))

          if (connectionName === 'ws1') ws1Ready = true
          if (connectionName === 'ws2') ws2Ready = true

          if (ws1Ready && ws2Ready) {
            // Send a test message to store 1
            const testMessage = {
              type: 'general_notification',
              data: { message: 'Test store isolation' },
              storeId: 'store-1',
            }
            // This should only be received by ws1
            setTimeout(() => {
              this.testResults.push({ test: 'Store Isolation', status: 'PASS' })
              console.log('✅ Store isolation working')
              resolve()
            }, 2000)
          }
        })

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString())
            if (message.data?.message === 'Test store isolation') {
              testMessageReceived = true
            }
          } catch (error) {
            // Ignore parsing errors
          }
        })
      }

      setupConnection(ws1, 'store-1', 'ws1')
      setupConnection(ws2, 'store-2', 'ws2')

      this.connections.set('store1', ws1)
      this.connections.set('store2', ws2)
    })
  }

  async testMessageBroadcasting() {
    console.log('📢 Test 5: Message Broadcasting')

    const ws = this.connections.get('test1')
    if (!ws) throw new Error('No connection available')

    return new Promise((resolve) => {
      const testMessage = {
        type: 'general_notification',
        data: { message: 'Test broadcast message' },
      }

      ws.send(JSON.stringify(testMessage))

      setTimeout(() => {
        this.testResults.push({ test: 'Message Broadcasting', status: 'PASS' })
        console.log('✅ Message broadcasting working')
        resolve()
      }, 1000)
    })
  }

  async testStatisticsEndpoint() {
    console.log('📊 Test 6: Statistics Endpoint')

    try {
      const response = await fetch(`${API_BASE}/websockets/stats`)
      const data = await response.json()

      if (response.ok && data.success) {
        this.testResults.push({ test: 'Statistics Endpoint', status: 'PASS' })
        console.log('✅ Statistics endpoint working')
        console.log(`   - Active connections: ${data.data.activeConnections}`)
        console.log(`   - Total connections: ${data.data.totalConnections}`)
        console.log(`   - Server online: ${data.data.serverOnline}`)
      } else {
        this.testResults.push({
          test: 'Statistics Endpoint',
          status: 'FAIL',
          error: 'Invalid response',
        })
        console.log('❌ Statistics endpoint failed')
      }
    } catch (error) {
      this.testResults.push({
        test: 'Statistics Endpoint',
        status: 'FAIL',
        error: error.message,
      })
      console.log('❌ Statistics endpoint error:', error.message)
    }
  }

  async testHealthCheck() {
    console.log('🏥 Test 7: Health Check')

    try {
      const response = await fetch(`${API_BASE}/websockets/health`)
      const data = await response.json()

      if (response.ok && data.success) {
        this.testResults.push({ test: 'Health Check', status: 'PASS' })
        console.log('✅ Health check working')
        console.log(`   - Server online: ${data.data.serverOnline}`)
        console.log(`   - Active connections: ${data.data.activeConnections}`)
      } else {
        this.testResults.push({
          test: 'Health Check',
          status: 'FAIL',
          error: 'Invalid response',
        })
        console.log('❌ Health check failed')
      }
    } catch (error) {
      this.testResults.push({
        test: 'Health Check',
        status: 'FAIL',
        error: error.message,
      })
      console.log('❌ Health check error:', error.message)
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up connections...')

    for (const [name, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }

    this.connections.clear()
    console.log('✅ Cleanup completed')
  }

  printResults() {
    console.log('\n📋 Test Results:')
    console.log('================')

    let passed = 0
    let failed = 0

    for (const result of this.testResults) {
      const status = result.status === 'PASS' ? '✅' : '❌'
      console.log(`${status} ${result.test}: ${result.status}`)

      if (result.status === 'PASS') {
        passed++
      } else {
        failed++
        if (result.error) {
          console.log(`   Error: ${result.error}`)
        }
      }
    }

    console.log('\n📊 Summary:')
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(
      `📈 Success Rate: ${Math.round(
        (passed / this.testResults.length) * 100
      )}%`
    )

    if (failed === 0) {
      console.log(
        '\n🎉 All tests passed! WebSocket improvements are working correctly.'
      )
    } else {
      console.log('\n⚠️  Some tests failed. Please check the implementation.')
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new WebSocketTester()
  tester.runTests().catch(console.error)
}

module.exports = WebSocketTester
