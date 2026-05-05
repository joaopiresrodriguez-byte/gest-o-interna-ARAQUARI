/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_GROQ_API_KEY?: string
    readonly VITE_GOOGLE_SEARCH_API_KEY?: string
    readonly VITE_SEARCH_ENGINE_ID?: string
    readonly VITE_GOOGLE_SHEETS_WEBHOOK_URL?: string
    readonly VITE_SHEETS_EFETIVO_ABA?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
