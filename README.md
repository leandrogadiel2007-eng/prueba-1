# Rubik Lab — Cubos 2×2 a 7×7

Aplicación web interactiva para practicar con seis tamaños de cubos tipo Rubik.

## Cubos disponibles
- **2×2×2 (Pocket Cube):** solo tiene piezas de esquina.
- **3×3×3:** el cubo clásico.
- **4×4×4 (Rubik's Revenge):** centros y aristas móviles.
- **5×5×5 (Professor's Cube).**
- **6×6×6.**
- **7×7×7.**

Todos los tamaños usan el mismo motor 3D de piezas y permiten girar las capas exteriores.

## Controles
- U, D, R, L, F y B: giro de una cara.
- Prima (′): giro inverso.
- 2: giro de 180°.
- Mezclar, deshacer, rehacer y reiniciar.
- Arrastrar el mouse o el dedo para orbitar la cámara; rueda para acercar o alejar.
- Teclas U, D, R, L, F y B; Shift invierte el giro.

## Otros rompecabezas oficiales
La WCA también contempla rompecabezas con geometrías y mecanismos diferentes: Pyraminx, Megaminx, Skewb y Square-1, además de Clock. No son simples cambios de tamaño del cubo y requieren motores de giro específicos.

## Ejecutar
Abre index.html desde un servidor web estático. La aplicación carga Three.js y OrbitControls desde jsDelivr, así que necesita conexión a internet.

## Publicar con GitHub Pages
1. Abre **Settings → Pages** en GitHub.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Selecciona la rama **main** y la carpeta **/ (root)**.
4. Guarda los cambios. GitHub mostrará la dirección pública de la página.

## Referencias
- [WCA Regulations — Article 9: Events](https://regulations.worldcubeassociation.org/).
- [WCA Competitor Tutorial](https://documents.worldcubeassociation.org/edudoc/competitor-tutorial/tutorial.pdf).
