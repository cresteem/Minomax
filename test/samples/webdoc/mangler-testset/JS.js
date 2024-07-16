/* mobile script */
if (window.matchMedia("(max-width: 1024px)").matches) {
  document.body.appendChild(createJS("/script/m-com.js"));
}
/* mobile script */

/* laptop script */
if (window.matchMedia("(min-width: 1025px)").matches) {
  document.body.appendChild(createJS("/script/com.js"));
  document.body.appendChild(createJS("/script/index.js"));
}
/* laptop script */
let herobtn = document.querySelector("#marketing > a");

let navList = document.querySelectorAll(".s-nav");
let tempnavList = Array.from(navList);
let chosen;

let point = document.querySelectorAll("#s-navlist > p:nth-child(odd)");
let rocket = document.querySelector("#s-pointer");
let servicescont = document.querySelector("#services-slide");
let servslidescroll = servicescont.scrollWidth / 8;

let heroslide = document.getElementById("m-carousal");
let heroslidescroll = heroslide.offsetHeight;
let heroparam, autohero, heroscrollcount, autohero_active;

let intro_text = document.querySelectorAll("#chevron>p > span");
let chev = document.querySelector(".chev");
let intro_active;

let navcont = document.querySelector("#s-navlist");
let nav_aniactive;

let whyhead1 = document.querySelector("#why-us > h1");
let whyhead2 = document.querySelector("#why-us > h2");
let rhead = document.querySelectorAll(".r-head");
let reasons = document.querySelectorAll(".reason");
let reason_active;

let prochead1 = document.querySelector("#procs > h1");
let prochead2 = document.querySelector("#procs > h2");
let procs = document.querySelectorAll(".proc");
let proc_img = document.querySelector("#proc-img");
let proc_active;

let techh1 = document.querySelector("#tech-stack > h1");
let techs = document.querySelector(".techs");
let tech_active;

let faq_bg = document.getElementById("faqs");
let faqs = document.querySelectorAll(".faq");
let faqh1 = document.querySelector("#home-faq > h1");
let faq_btn = document.querySelector("#home-faq > a");
let faq_active;

let graph = document.querySelector("#graph");
let who_we = document.querySelector("#who-we > div");
let who_we_active;

let connect_head = document.querySelector("#connect-us > p:nth-child(1)");
let connect_ptags = document.querySelectorAll("#connect-us > .contact");

let follow_head = document.querySelector("#connect-us > p:nth-child(8)");
let sm_icon = document.querySelectorAll("#sm-links .social-media");

navEvent();
toggglehero();

function reorderNav(position) {
  chosen = tempnavList[position];
  tempnavList.splice(position, 1);
  tempnavList.splice(3, 0, chosen);
  return chosen;
}

function updateNav(position) {
  chosen = reorderNav(position);
  tempnavList.forEach((_, index) => {
    const newElement = document.createElement("p");
    newElement.className = "s-nav";
    newElement.id = tempnavList[index].id;
    newElement.textContent = tempnavList[index].textContent;

    const existingElement = navList[index];
    newElement.classList.toggle("nav-ani");
    rocket.classList.toggle("rocket-ani");
    toggleclasspointer();
    existingElement.parentNode.replaceChild(newElement, existingElement);
    setTimeout(() => {
      newElement.classList.toggle("nav-ani");
      rocket.classList.toggle("rocket-ani");
      toggleclasspointer();
    }, 250);
  });
  serviceSlider(chosen.id);
  navEvent();
}

function navEvent() {
  navList = document.querySelectorAll(".s-nav");
  navList.forEach((element, index) => {
    element.addEventListener(
      "click",
      () => {
        updateNav(index);
      },
      { once: true }
    );
  });
}

function toggleclasspointer() {
  point.forEach((element) => {
    element.classList.toggle("point-ani");
  });
}

let sno;
function serviceSlider(id) {
  if (id === "md") {
    sno = 0;
  } else if (id === "wd") {
    sno = 1;
  } else if (id === "dd") {
    sno = 2;
  } else if (id === "ui") {
    sno = 3;
  } else if (id === "seo") {
    sno = 4;
  } else if (id === "ss") {
    sno = 5;
  } else if (id === "dm") {
    sno = 6;
  } else if (id === "bauto") {
    sno = 7;
  }
  servicescont.scrollTo(sno * servslidescroll, 0);
}

function heroscroll(forward) {
  /* @param {boolean or number} - forward */
  if (heroscrollcount < 5) {
    if (forward === 1) {
      heroslide.scrollBy(0, heroslidescroll);
    } else {
      heroslide.scrollBy(0, -heroslidescroll);
    }
  } else {
    clearInterval(autohero);
    toggglehero();
  }
  heroscrollcount += 1;
}

function toggglehero() {
  heroparam ? (heroparam = 0) : (heroparam = 1);
  autohero = setInterval(() => {
    heroscroll(heroparam);
  }, 2000);
  heroscrollcount = 0;
  autohero_active = true;
}

/* quote things*/
// Get references to the form elements
const nameInput = document.getElementById("c-name");
const phoneInput = document.getElementById("c-phone");
const emailInput = document.getElementById("c-email");
const reqInput = document.getElementById("creq");
const sendButton = document.getElementById("send-btn");

function setWarning(element, placeholder) {
  element.style.borderColor = "red";
  element.value = "";
  element.setAttribute("placeholder", placeholder);
  element.addEventListener(
    "focus",
    function () {
      this.style.borderColor = "#4E4FEB";
    },
    { once: true }
  );
}

function isValidEmail(email) {
  // Regular expression for validating email
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;

  return emailRegex.test(email);
}

function clearquote() {
  nameInput.value = "";
  phoneInput.value = "";
  emailInput.value = "";
  reqInput.value = "";
}

// Event listener for the Send button
sendButton.addEventListener("click", () => {
  if (phoneInput.value.length > 10 || phoneInput.value.length !== 10) {
    setWarning(phoneInput, "10 digits only");
    return;
  }

  if (!isValidEmail(emailInput.value)) {
    setWarning(emailInput, "Invalid Email");
    return;
  }
  if (nameInput.value.length > 100) {
    setWarning(nameInput, "Try shorter name");
    return;
  }

  if (reqInput.value === "") {
    setWarning(reqInput, "Requirement?");
    return;
  }
  validated = true;
  const formData = new FormData();
  formData.append("cname", nameInput.value);
  formData.append("cphone", phoneInput.value);
  formData.append("cemail", emailInput.value);
  formData.append("creq", reqInput.value);

  clearquote();
  fetch("/server/getform.php", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      if (data === 1) {
        alert("Thanks for your interest :)\n We will contact you soon");
      } else {
        alert("Sorry :( we failed to get your request.\nKindly Try Again.");
      }
    })
    .catch((error) => {});
});

/* quote things ended*/
