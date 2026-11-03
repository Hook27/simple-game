// Op smalle schermen past de menubalk niet in beeld en scrolt hij zijwaarts.
// Zet het tabblad van de huidige pagina dan in het midden, zodat je ziet waar je bent.
(function () {
  const tab = document.querySelector('.nav-tab.actief');
  if (!tab) return;
  const balk = tab.parentElement;
  if (balk.scrollWidth <= balk.clientWidth) return;
  balk.scrollLeft = tab.offsetLeft - balk.offsetLeft - (balk.clientWidth - tab.offsetWidth) / 2;
})();
