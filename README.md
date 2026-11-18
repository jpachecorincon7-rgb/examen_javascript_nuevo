# &#128203; TASKSNAP — Gestor de Tareas

**TASKSNAP** es una aplicación web de gestión de tareas construida con HTML, CSS y JavaScript puro. Permite crear, editar, eliminar y filtrar tareas propias, así como importar tareas desde una API pública. Toda la información se almacena en el navegador mediante `localStorage`.

---

## &#128101; Autores

Proyecto desarrollado como entrega académica por:

- **[Darly Cuteño]**
- **[Juan David Pacheco]**

Curso: JavaScript · Fecha de entrega: 9 de noviembre 2026

---

## &#128640; Instrucciones de uso y despliegue

### Requisitos previos

- Un navegador moderno (Chrome 90+, Firefox 88+, Edge 90+, Safari 15+).
- Un servidor local para evitar restricciones de CORS con módulos ES6.  
  Se recomienda la extensión **Live Server** de VS Code.

### Pasos para ejecutar

1. Clona o descarga el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/ProyectoTareas_JavaScript_ApellidoNombre.git
   ```
2. Abre la carpeta del proyecto en **Visual Studio Code**.
3. Haz clic derecho sobre `index.html` → **"Open with Live Server"**.
4. La aplicación se abre automáticamente en `http://127.0.0.1:5500`.

> ⚠️ **No abras `index.html` directamente** con doble clic (protocolo `file://`). Los módulos ES6 (`type="module"`) requieren un servidor HTTP para funcionar correctamente.

### Alternativa sin VS Code

Puedes usar cualquier servidor local:

```bash
# Con Python 3
python -m http.server 5500

# Con Node.js (npx)
npx serve .
```

Luego abre `http://localhost:5500` en el navegador.

---

## &#128450;&#65039; Estructura del proyecto

```
ProyectoTareas_JavaScript_ApellidoNombre-main/
│
├── index.html                  # Punto de entrada de la aplicación
├── README.md                   # Documentación del proyecto
│
├── css/
│   └── styles.css              # Estilos globales y responsive
│
├── js/
│   ├── components/
│   │   ├── taskapp.js          # Componente principal: lista, filtros y botones
│   │   ├── taskmodal.js        # Formulario modal: crear y editar tareas
│   │   └── importmodal.js      # Modal de importación desde la API
│   └── services/
│       ├── api.js              # Consumo del endpoint de JSONPlaceholder
│       └── storage.js          # Persistencia en localStorage + generador de IDs
│
└── wireframes/
    ├── wireframe.jpg    
    ├── wireframe.jpg 
    └── wireframe.jpg   
```

---

## &#10024; Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| **Crear tarea** | Abre un formulario modal con título, fecha y estado |
| **Editar tarea** | Reutiliza el mismo modal precargado con los datos existentes |
| **Eliminar tarea** | Elimina una tarea con diálogo de confirmación previo |
| **Vaciar lista** | Elimina todas las tareas con confirmación |
| **Marcar terminadas** | Marca todas las tareas locales pendientes como completadas |
| **Importar tareas** | Abre un modal con el banco de tareas de la API para seleccionar |
| **Filtrar por estado** | Muestra todas, solo pendientes o solo completadas |
| **Buscar** | Filtra en tiempo real por texto del título |
| **Persistencia** | Todas las tareas se guardan en `localStorage` |

---

## &#128444;&#65039; Wireframes

| Wireframes propuesto | Archivo |
|---|---|
| Lista principal de tareas | [`wireframe.jpg`](./wireframes/panel_principal.png) |
| Modal formulario (crear / editar) | [`wireframe.jpg`](./wireframes/nueva_tarea.png) |
| Modal de importación desde la API | [`wireframe.jpg`](./wireframes/importar_tareas.png) |

| Wireframes realizado | Archivo |
|---|---|
| Lista principal de tareas | [`wireframe.jpg`](./wireframes/panel-principal.png) |
| Modal formulario (crear / editar) | [`wireframe.jpg`](./wireframes/nueva-tarea.png) |
| Modal de importación desde la API | [`wireframe.jpg`](./wireframes/importar-tareas.png) |

---

## &#127959;&#65039; Descripción de la lógica implementada

### Web Components y Shadow DOM

La aplicación está construida íntegramente con **Web Components nativos** (`customElements.define`). Cada componente usa `attachShadow({ mode: 'open' })` para encapsular su estructura y estilos mediante **Shadow DOM**, evitando conflictos de estilos entre componentes.

| Componente | Elemento HTML | Responsabilidad |
|---|---|---|
| `TaskApp` | `<task-app>` | Vista principal: lista, filtros, botones, resumen |
| `TaskModal` | `<task-modal>` | Formulario modal de creación y edición |
| `ImportModal` | `<import-modal>` | Modal de selección e importación de tareas de la API |

### Estándar de identificadores (IDs)

Todas las tareas tienen un `id` único en formato `string` según su origen:

```
Tareas creadas en la app:    "local-<timestamp>-<aleatorio>"
                              Ejemplo: "local-1731185400000-k3r9a"

Tareas importadas de la API: "api-<id original>"
                              Ejemplo: "api-42"
```

Este estándar permite identificar el origen de cualquier tarea sin campos extra, y se usa para aplicar las restricciones de solo lectura a las importadas.

### Restricción de tareas importadas

Las tareas cuyo `id` empieza con `"api-"` son de **solo lectura**: no se pueden editar ni marcar como completadas. Solo es posible eliminarlas. Esta restricción se aplica en tres niveles:

1. **UI**: el botón Editar y el checkbox se deshabilitan (`disabled`).
2. **Componente**: `TaskModal.open()` retorna inmediatamente si detecta un ID tipo `api-`.
3. **Acción masiva**: "Marcar Terminadas" omite las tareas importadas explícitamente.

### Persistencia en localStorage

El servicio `StorageService` gestiona todo el acceso al almacenamiento:

- **Clave de almacenamiento**: `proyecto_tareas_db`
- **Formato**: JSON array de objetos `{ id, title, date, completed }`
- **Resiliencia**: si el JSON guardado está corrupto, se devuelve un array vacío en lugar de lanzar un error.
- **Control de cuota**: si el `localStorage` está lleno, se informa al usuario con un mensaje de error (toast) sin bloquear la app.

### Consumo de la API pública

El servicio `ApiService` consume el endpoint `https://jsonplaceholder.typicode.com/todos`:

- **Timeout de 8 segundos** con `AbortController` para no dejar al usuario esperando indefinidamente.
- Mensajes de error diferenciados: timeout, error HTTP, respuesta con formato inesperado, sin conexión a internet.
- El banco de tareas se descarga **una sola vez** y se reutiliza mientras el modal esté en memoria.
- Botón **Reintentar** visible si la carga falla.

### UX y Accesibilidad

- Modales con `role="dialog"`, `aria-modal="true"` y `aria-labelledby` para lectores de pantalla.
- Diálogo de confirmación con `role="alertdialog"` para acciones destructivas.
- Atributo `inert` en el fondo mientras hay un modal abierto (impide foco y clics accidentales).
- Foco devuelto al elemento que abrió el modal al cerrarlo.
- Tecla `Escape` y clic en el fondo oscuro cierran cualquier modal.
- `aria-live="polite"` en la lista y en el resumen para anunciar cambios a lectores de pantalla.
- `prefers-reduced-motion` respetado: las animaciones del toast se desactivan si el usuario lo prefiere.
- Diseño **responsive** con breakpoints en 768 px y 480 px.
- Sanitización de HTML con `escapeHTML()` para prevenir inyección de contenido malicioso.


## &#128736;&#65039; Tecnologías utilizadas

| Tecnología | Uso |
|---|---|
| **HTML5** | Estructura semántica de la aplicación |
| **CSS3** | Estilos, animaciones y diseño responsive |
| **JavaScript ES6+** | Lógica de la aplicación, módulos, async/await |
| **Web Components** | Encapsulación de componentes reutilizables |
| **Shadow DOM** | Aislamiento de estilos por componente |
| **localStorage** | Persistencia de datos en el navegador |
| **Fetch API** | Consumo del endpoint REST de JSONPlaceholder |
| **AbortController** | Control de timeout en peticiones HTTP |

---

## &#128225; API utilizada

**JSONPlaceholder Todos**  
`GET https://jsonplaceholder.typicode.com/todos`

Devuelve un array de 200 tareas con la estructura:
```json
{
  "userId": 1,
  "id": 1,
  "title": "delectus aut autem",
  "completed": false
}
```

Al importarse, cada tarea se transforma al formato interno de TASKSNAP:
```json
{
  "id": "api-1",
  "title": "delectus aut autem",
  "date": "2026-11-09",
  "completed": false
}
```
