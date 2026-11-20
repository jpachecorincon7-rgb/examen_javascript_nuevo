const STORAGE_KEY = 'proyecto_tareas_db';
const CATEGORIES_KEY = 'proyecto_categorias_db';

export const StorageService = {
    // Lee las tareas del localStorage. Nunca lanza error: si no hay datos
    // o el JSON está dañado, devuelve un arreglo vacío.
    getTasks() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (!Array.isArray(data)) return [];
            // Descarta registros inválidos para que la UI no falle con title/id inexistentes
            return data.filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string');
        } catch (error) {
            console.error('No se pudieron leer las tareas guardadas:', error);
            return [];
        }
    },

    // Guarda el arreglo como JSON. Devuelve true si se guardó y false si falló
    // (por ejemplo, almacenamiento lleno o bloqueado por el navegador).
    saveTasks(tasks) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
            return true;
        } catch (error) {
            console.error('No se pudieron guardar las tareas:', error);
            return false;
        }
    },

    // Lee las categorías del localStorage.
    getCategories() {
        try {
            const data = JSON.parse(localStorage.getItem(CATEGORIES_KEY));
            if (!Array.isArray(data)) return [];
            return data.filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string');
        } catch (error) {
            console.error('No se pudieron leer las categorías guardadas:', error);
            return [];
        }
    },

    // Guarda el arreglo de categorías como JSON.
    saveCategories(categories) {
        try {
            localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
            return true;
        } catch (error) {
            console.error('No se pudieron guardar las categorías:', error);
            return false;
        }
    },

    // ESTÁNDAR DE IDENTIFICADORES PROPIO
    // - Importadas de la API: "api-<id original>"  (solo lectura, solo se pueden eliminar)
    // - Creadas en la app:    "local-<timestamp>-<aleatorio>"
    generateId(origin = 'local', originalId = null) {
        if (origin === 'api') {
            if (originalId === null || originalId === undefined) {
                throw new Error('generateId("api") requiere el id original de la tarea.');
            }
            return `api-${originalId}`;
        }
        return `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }
};
