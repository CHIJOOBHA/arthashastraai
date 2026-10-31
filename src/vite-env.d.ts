/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_DATABASE_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface ImportMetaEnv {
  readonly VITE_RAZORPAY_KEY_ID?: string
  readonly VITE_LEGAL_ENTITY?: string
  readonly VITE_LEGAL_ADDRESS?: string
  readonly VITE_CONTACT_EMAIL?: string
  readonly VITE_GRIEVANCE_OFFICER?: string
  readonly VITE_GRIEVANCE_EMAIL?: string
  readonly VITE_PRICE_LABEL?: string
  readonly VITE_GOVERNING_LAW?: string
}
