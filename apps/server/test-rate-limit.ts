/**
 * Rate Limiting Test Script
 * 
 * This script tests the rate limiting middleware by sending multiple requests
 * and checking for 429 (Too Many Requests) responses.
 */

const BASE_URL = process.env.API_URL || "http://localhost:3000";
const TEST_ENDPOINT = "/";
const MAX_REQUESTS = 1005; // Test exceeding the limit (default is 1000)

interface RateLimitHeaders {
	limit?: string;
	remaining?: string;
	reset?: string;
}

interface TestResult {
	requestNumber: number;
	status: number;
	rateLimitHeaders: RateLimitHeaders;
	timestamp: string;
}

async function testRateLimit() {
	console.log(`🧪 Testing Rate Limiting on ${BASE_URL}${TEST_ENDPOINT}\n`);
	console.log(`Sending ${MAX_REQUESTS} requests...\n`);

	const results: TestResult[] = [];
	let rateLimitedCount = 0;
	let successCount = 0;

	for (let i = 1; i <= MAX_REQUESTS; i++) {
		try {
			const response = await fetch(`${BASE_URL}${TEST_ENDPOINT}`, {
				method: "GET",
			});

			const rateLimitHeaders: RateLimitHeaders = {
				limit: response.headers.get("RateLimit-Limit") || undefined,
				remaining: response.headers.get("RateLimit-Remaining") || undefined,
				reset: response.headers.get("RateLimit-Reset") || undefined,
			};

			results.push({
				requestNumber: i,
				status: response.status,
				rateLimitHeaders,
				timestamp: new Date().toISOString(),
			});

			if (response.status === 429) {
				rateLimitedCount++;
				console.log(
					`❌ Request #${i}: Rate Limited (429) - Remaining: ${rateLimitHeaders.remaining}`,
				);
			} else if (response.status === 200) {
				successCount++;
				if (i % 10 === 0 || i <= 5 || i >= MAX_REQUESTS - 5) {
					console.log(
						`✅ Request #${i}: Success (${response.status}) - Remaining: ${rateLimitHeaders.remaining}`,
					);
				}
			} else {
				console.log(
					`⚠️  Request #${i}: Status ${response.status} - Remaining: ${rateLimitHeaders.remaining}`,
				);
			}

			// Small delay to avoid overwhelming the server
			await new Promise((resolve) => setTimeout(resolve, 10));
		} catch (error) {
			console.error(`❌ Request #${i} failed:`, error);
		}
	}

	// Print summary
	console.log("\n" + "=".repeat(60));
	console.log("📊 RATE LIMITING TEST SUMMARY");
	console.log("=".repeat(60));
	console.log(`Total Requests:        ${MAX_REQUESTS}`);
	console.log(`✅ Successful (200):    ${successCount}`);
	console.log(`❌ Rate Limited (429):  ${rateLimitedCount}`);
	console.log("=".repeat(60));

	// Show first rate-limited request details
	const firstRateLimited = results.find((r) => r.status === 429);
	if (firstRateLimited) {
		console.log("\n📍 First Rate Limited Request:");
		console.log(`   Request Number: ${firstRateLimited.requestNumber}`);
		console.log(`   Limit: ${firstRateLimited.rateLimitHeaders.limit}`);
		console.log(`   Remaining: ${firstRateLimited.rateLimitHeaders.remaining}`);
		console.log(`   Reset: ${firstRateLimited.rateLimitHeaders.reset}`);
	}

	// Test passed if we got rate limited
	if (rateLimitedCount > 0) {
		console.log("\n✅ Rate limiting is working correctly!");
	} else {
		console.log("\n⚠️  Warning: No rate limiting detected. Check your configuration.");
	}

	console.log("\n💡 Tip: Wait 15 minutes for the rate limit to reset and try again.\n");
}

// Run the test
testRateLimit().catch(console.error);
