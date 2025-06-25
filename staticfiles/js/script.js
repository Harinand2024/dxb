
  var settingsMenu = document.querySelector(".setting_menu");
  var darkBtn = document.getElementById("dark_btn");

  // Define the function and expose it globally
  function settingsMenuToggle() {
      settingsMenu.classList.toggle("setting_menu_height");
  }
  window.settingsMenuToggle = settingsMenuToggle; // 👈 Make it global

  // Dark mode toggle
  darkBtn.onclick = function () {
      darkBtn.classList.toggle("dark_btn_on");
  };

  // Example value-passing logic
  let btnGet = document.querySelector('#button_value');
  let inputGet = document.querySelector('#input_vlaue');  // (Check spelling here!)
  let post = document.querySelector('#post');

  btnGet?.addEventListener('click', () => {
      post.innerText = inputGet.value;
  });

