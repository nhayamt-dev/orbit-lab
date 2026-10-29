"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const year = String(new Date().getFullYear());

  const yearElement = document.getElementById("year");
  const footerYearElement = document.getElementById("footer-year");

  if (yearElement) {
    yearElement.textContent = year;
  }

  if (footerYearElement) {
    footerYearElement.textContent = year;
  }
});
