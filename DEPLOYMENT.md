# Guía de Despliegue y Configuración

## 1. Versión Web (PWA)

La aplicación ha sido configurada como una Progressive Web App (PWA), lo que permite:
- Instalación en escritorio y móviles.
- Icono en pantalla de inicio.
- Pantalla de carga (Splash screen).

### Pasos para desplegar la Web:
1. **Frontend (Cliente React):**
   - Ejecuta `npm run build` para generar la carpeta `dist`.
   - Sube esta carpeta a cualquier hosting estático gratuito:
     - **Vercel**: Instala CLI (`npm i -g vercel`) y ejecuta `vercel deploy`.
     - **Netlify**: Arrastra la carpeta `dist` a su panel de control.
   
2. **Backend (Servidor Node.js):**
   - El servidor Socket.io debe estar alojado en un servicio que soporte WebSockets y Node.js.
   - **Render.com (Recomendado Gratuito):**
     1. Crea una cuenta en Render.
     2. Selecciona "Web Service".
     3. Conecta tu repositorio GitHub.
     4. Configura el `Root Directory` a `server`.
     5. Comando de Build: `npm install`.
     6. Comando de Start: `node index.js`.
   - **Nota sobre Base de Datos:**
     - En la versión gratuita de Render, los archivos locales (SQLite `mafia.db`) se pierden cada vez que el servidor se reinicia.
     - Para producción real, cambia SQLite por **PostgreSQL** (disponible gratis en Neon.tech o Supabase).

3. **Conexión Cliente-Servidor:**
   - **No necesitas editar el código manualmente.**
   - He configurado la app para leer la URL del servidor desde una variable de entorno.
   - En tu panel de hosting (Vercel/Netlify), busca la sección "Environment Variables" y añade:
     - **Key:** `VITE_SERVER_URL`
     - **Value:** La URL de tu backend en Render (ej: `https://mi-mafia-server.onrender.com`)
   - Al hacer esto y redesplegar, la web se conectará automáticamente a esa URL.

## 2. Versión Android (APK)

La aplicación utiliza **Capacitor** para empaquetar la web en una app nativa.

### Requisitos Previos:
- Descargar e instalar **Android Studio**.
- SDK de Android instalado (se hace desde Android Studio).

### Pasos para generar APK:
1. Asegúrate de haber construido la web:
   ```bash
   npm run build
   ```
2. Sincroniza los archivos con el proyecto Android:
   ```bash
   npx cap sync
   ```
3. Abre el proyecto en Android Studio:
   ```bash
   npx cap open android
   ```
4. En Android Studio:
   - Espera a que Gradle termine de sincronizar.
   - Ve a `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`.
   - El APK se generará en `android/app/build/outputs/apk/debug/app-debug.apk`.

### Configuración Importante para Android:
- **Acceso a Internet:** El permiso `android.permission.INTERNET` ya se incluye por defecto.
- **Conexión al Servidor:**
  - Si pruebas en el emulador de Android Studio, `localhost` es `10.0.2.2`.
  - Si pruebas en un dispositivo físico, el teléfono y la PC deben estar en la misma red Wi-Fi y debes usar la IP local de tu PC (ej: `http://192.168.1.5:3000`).
  - Para producción, usa la URL HTTPS de tu servidor desplegado (Render/etc).

## 3. Resumen de Comandos

| Acción | Comando |
|--------|---------|
| Iniciar Servidor Dev | `npm run dev` (en carpeta server) |
| Iniciar Cliente Dev | `npm run dev` (en carpeta raíz) |
| Construir Web | `npm run build` |
| Sincronizar Android | `npx cap sync` |
| Abrir Android Studio | `npx cap open android` |
