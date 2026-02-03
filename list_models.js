import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyCcCpcprQcxd6oEMSKWNewHsG8LmT5KNjY");

async function listModels() {
    try {
        const list = await genAI.listModels();
        console.log("AVAILABLE MODELS:");
        list.models.forEach(m => console.log(`- ${m.name} (supports: ${m.supportedGenerationMethods.join(", ")})`));
    } catch (e) {
        console.error("Error listing models:", e);
    }
}

listModels();
