import { S3Client } from "@aws-sdk/client-s3";

const internalEndpoint = process.env.AWS_S3_ENDPOINT || "http://minio:9000";
const publicEndpoint = process.env.PUBLIC_S3_ENDPOINT || "https://s3.ayushk.me";

// 1. INTERNAL CLIENT (For server operations like delete, list)
export const s3Client = new S3Client({
	region: process.env.AWS_REGION || "us-east-1",
	endpoint: internalEndpoint,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
	},
	forcePathStyle: true, // Critical for MinIO
});

// 2. PRESIGNER CLIENT (For generating public URLs)
export const s3Presigner = new S3Client({
	region: process.env.AWS_REGION || "us-east-1",
	endpoint: publicEndpoint, // <--- THIS IS THE FIX. Signs with the correct hostname.
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
	},
	forcePathStyle: true,
});

export const BUCKET_NAME = process.env.AWS_S3_BUCKET || "krypt-vault-files";
