'use client';

import { ProtectedRoute } from '@/components/auth';
import { ConversationLayoutResponsive } from '@/components/conversations/ConversationLayoutResponsive';
import { pipeline, env } from '@huggingface/transformers';
env.allowLocalModels = false; // Skip check for models hosted locally

const c = console;

function progress_callback(x) {
    if (x.status === "done") {
        c.log(`Done: ${x.file}`);
    }
    if (x.status === "ready") {
        c.log("Translator ready 🔥");
    }
}

async function initializeTranslator() {
    try {
        const translator = await pipeline('translation', 'Xenova/nllb-200-distilled-600M', { progress_callback });
        return translator;
    } catch (error) {
        c.error("Failed to initialize translator:", error);
        throw error;
    }
}

async function translateText(text, src_lang, tgt_lang, translator) {
    try {
        const result = await translator(text, { src_lang, tgt_lang });
        return result[0].translation_text;
    } catch (error) {
        c.error("Translation error:", error);
        throw error;
    }
}

const main = async () => {
    const translator = await initializeTranslator();
    const text = "Hello, world!";
    const src_lang = "eng_Latn";
    const tgt_lang = "fra_Latn";
    c.log(`Translating "${text}" from ${src_lang} to ${tgt_lang}...`);
    const translatedText = await translateText(text, src_lang, tgt_lang, translator);
    c.log(`Translated text: ${translatedText}`);
};

main().catch(error => c.error("Error in main function:", error));
  // translationCache.set(cacheKey, translation);
// }

// export { initializeTranslator, translateText };

export default function ConversationsPage() {
  return (
    <ProtectedRoute>
      <ConversationLayoutResponsive />
    </ProtectedRoute>
  );
}
