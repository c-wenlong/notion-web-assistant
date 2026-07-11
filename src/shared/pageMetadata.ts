export const PAGE_METADATA_MESSAGE = "nova:get-page-metadata";

export interface PageMetadata {
  title: string;
  url: string;
  text: string;
}

export interface PageMetadataRequest {
  type: typeof PAGE_METADATA_MESSAGE;
}
