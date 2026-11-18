const API_URL = 'https://jsonplaceholder.typicode.com/todos';
const TIMEOUT_MS = 8000;  // Tiempo máximo de espera de la API
 
export const ApiService = {
    // Devuelve TODO el banco (200 tareas). El usuario decide cuáles importar.
    async fetchTodoBank() {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
 
        try {
            const response = await fetch(API_URL, { signal: controller.signal });
 
            if (!response.ok) {
                throw new Error(`El servidor respondió con el error ${response.status}.`);
            }
 
            const data = await response.json();
 
            if (!Array.isArray(data)) {
                throw new Error('La API devolvió un formato inesperado.');
            }
 
            // Descarta registros inválidos para que el modal nunca pinte "undefined"
            return data.filter((t) => t && t.id != null && typeof t.title === 'string');
 
        } catch (error) {
            console.error('Error en ApiService:', error);
 
            // Mensajes claros según el tipo de fallo (el ImportModal los muestra al usuario)
            if (error.name === 'AbortError') {
                throw new Error('La API tardó demasiado en responder. Inténtalo de nuevo.');
            }
            if (error instanceof SyntaxError) {
                throw new Error('La respuesta de la API no es válida.');
            }
            if (error instanceof TypeError) { // fetch lanza TypeError cuando no hay red
                throw new Error('No se pudo conectar con la API. Revisa tu conexión a internet.');
            }
            throw error; // Errores ya descritos arriba (código HTTP, formato)
        } finally {
            clearTimeout(timer);
        }
    }
};