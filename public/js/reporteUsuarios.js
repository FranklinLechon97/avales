
async function generarPDFUsuarios() {
  try {

    const respuesta = await fetch(
      '/api/reportes/usuarios/pdf'
    );

    if (!respuesta.ok) {
      throw new Error('Error al generar PDF');
    }

    const archivo = await respuesta.blob();
    const url = URL.createObjectURL(archivo);

    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = 'reporte_usuarios.pdf';

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

  } catch (error) {

    console.error(error);
    alert('No se pudo generar el PDF');

  }
}

window.generarPDFUsuarios = generarPDFUsuarios;
