export const REKOGNITION_FACE_LIVENESS_REGIONS = [
  "us-east-1",
  "us-west-2",
  "eu-west-1",
  "ap-south-1",
  "ap-northeast-1",
  "sa-east-1",
  "ap-southeast-5",
  "ap-southeast-7",
] as const;

export type RekognitionFaceLivenessRegion = (typeof REKOGNITION_FACE_LIVENESS_REGIONS)[number];

const REGION_SET = new Set<string>(REKOGNITION_FACE_LIVENESS_REGIONS);

export function isRekognitionFaceLivenessRegion(region: string): region is RekognitionFaceLivenessRegion {
  return REGION_SET.has(region);
}
