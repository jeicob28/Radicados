// Pie de página: sigla del SGDEA, crédito de elaboración y una frase
// célebre que cambia cada día (misma para todos, según el día del año).

const SGDEA = 'Sistema de Gestión de Documentos Electrónicos de Archivo';

const FRASES: { t: string; a: string }[] = [
  { t: 'El orden es el placer de la razón; el desorden, la delicia de la imaginación.', a: 'Paul Claudel' },
  { t: 'La calidad nunca es un accidente; siempre es el resultado de un esfuerzo inteligente.', a: 'John Ruskin' },
  { t: 'La excelencia no es un acto, es un hábito.', a: 'Aristóteles' },
  { t: 'Haz las cosas ordinarias extraordinariamente bien.', a: 'John D. Rockefeller Jr.' },
  { t: 'Cuida los pequeños detalles; un pequeño agujero hunde un gran barco.', a: 'Benjamin Franklin' },
  { t: 'Nunca dejes para mañana lo que puedas hacer hoy.', a: 'Benjamin Franklin' },
  { t: 'El tiempo es el recurso más escaso y, si no se gestiona, nada más puede gestionarse.', a: 'Peter Drucker' },
  { t: 'Lo que no se mide no se puede mejorar.', a: 'William Thomson, Lord Kelvin' },
  { t: 'Solos podemos hacer muy poco; juntos podemos hacer mucho.', a: 'Helen Keller' },
  { t: 'La cooperación es la convicción de que nadie llega a la meta si no llegan todos.', a: 'Virginia Burden' },
  { t: 'Un pueblo que no conoce su historia está condenado a repetirla.', a: 'George Santayana' },
  { t: 'La memoria es el escriba del alma.', a: 'Aristóteles' },
  { t: 'El que es fiel en lo poco, también es fiel en lo mucho.', a: 'Evangelio de Lucas' },
  { t: 'La disciplina es el puente entre las metas y los logros.', a: 'Jim Rohn' },
  { t: 'La paciencia es amarga, pero su fruto es dulce.', a: 'Jean-Jacques Rousseau' },
  { t: 'No cuentes los días; haz que los días cuenten.', a: 'Muhammad Ali' },
  { t: 'El secreto para salir adelante es empezar.', a: 'Mark Twain' },
  { t: 'Las grandes obras no se hacen con la fuerza, sino con la perseverancia.', a: 'Samuel Johnson' },
  { t: 'La confianza tarda años en construirse y segundos en romperse.', a: 'Anónimo' },
  { t: 'Servir a los demás es el alquiler que pagamos por nuestro lugar en la vida.', a: 'Muhammad Ali' },
  { t: 'Trata a las personas como si fueran lo que deberían ser y las ayudarás a serlo.', a: 'Johann W. Goethe' },
  { t: 'La responsabilidad es el precio de la grandeza.', a: 'Winston Churchill' },
  { t: 'La perfección se alcanza cuando ya no hay nada más que quitar.', a: 'Antoine de Saint-Exupéry' },
  { t: 'La puntualidad es la cortesía de los reyes.', a: 'Luis XVIII' },
  { t: 'Lo que se escribe permanece; lo que se habla se lo lleva el viento.', a: 'Locución latina' },
  { t: 'El único modo de hacer un gran trabajo es amar lo que haces.', a: 'Steve Jobs' },
  { t: 'Empieza haciendo lo necesario, luego lo posible, y de repente harás lo imposible.', a: 'San Francisco de Asís' },
  { t: 'La gota horada la piedra no por su fuerza, sino por su constancia.', a: 'Ovidio' },
  { t: 'La honradez es el primer capítulo del libro de la sabiduría.', a: 'Thomas Jefferson' },
  { t: 'Vísteme despacio, que tengo prisa.', a: 'Refrán español' },
  { t: 'Eficacia es hacer las cosas bien; eficiencia es hacer bien las cosas correctas.', a: 'Peter Drucker' },
  { t: 'Un viaje de mil leguas comienza con el primer paso.', a: 'Lao-Tse' },
  { t: 'La reputación es lo que otros piensan de ti; el carácter, lo que eres en la oscuridad.', a: 'John Wooden' },
  { t: 'La suerte es lo que sucede cuando la preparación se encuentra con la oportunidad.', a: 'Séneca' },
  { t: 'Un problema bien planteado está medio resuelto.', a: 'Charles Kettering' },
  { t: 'Valen más los pequeños actos que se ejecutan que los grandes que solo se planean.', a: 'Peter Marshall' },
  { t: 'Más vale una palabra a tiempo que cien a destiempo.', a: 'Refrán' },
  { t: 'El trabajo bien hecho no necesita quien lo defienda.', a: 'Refrán' },
  { t: 'Comienza donde estás, usa lo que tienes, haz lo que puedas.', a: 'Arthur Ashe' },
  { t: 'La constancia vence lo que la dicha no alcanza.', a: 'Simón Bolívar' },
  { t: 'Quien quiera mover el mundo, que se mueva primero a sí mismo.', a: 'Sócrates' },
  { t: 'Cae siete veces y levántate ocho.', a: 'Proverbio japonés' },
];

function fraseDelDia(): { t: string; a: string } {
  const hoy = new Date();
  const inicio = Date.UTC(hoy.getFullYear(), 0, 0);
  const dia = Math.floor((Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - inicio) / 86_400_000);
  return FRASES[dia % FRASES.length];
}

export default function PieDePagina({ compacto = false }: { compacto?: boolean }) {
  const frase = fraseDelDia();
  return (
    <footer className={`pie ${compacto ? 'pie-compacto' : ''}`}>
      <p className="pie-frase">
        «{frase.t}» <span className="pie-autor">— {frase.a}</span>
      </p>
      <p className="pie-credito">
        <abbr title={SGDEA}>SGDEA</abbr> · {SGDEA}
        <span className="pie-sep"> · </span>
        Elaborado por Jeicob Hoyos
      </p>
    </footer>
  );
}
