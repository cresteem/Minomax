<div align="center">

![Minomax logo](./logo/logo.webp)

# Minomax - Comprehensive Web Optimization for Modern Needs

<p id="intro">
Minomax is a cutting-edge optimization tool tailored to enhance the performance of your web projects. Whether you're a developer striving for faster load times or a business aiming to deliver a seamless user experience, Minomax offers a powerful, all-encompassing solution.  

By efficiently compressing images, videos, and web documents (HTML, CSS, and JavaScript), Minomax ensures minimal resource usage without sacrificing quality. Its advanced capabilities include generating image sets for various screen sizes—perfectly suited for devices ranging from smartphones to desktops—and creating video thumbnails to enhance accessibility.  
</p>

Minomax achieves impressive compression ratios:  
- **97%** for images,
- **93%** for videos, and  
- **25%** for web documents (HTML, JS, CSS).  

Unlike traditional optimization tools, Minomax integrates effortlessly with cloud services like Cloudflare, providing a dual advantage: pre-optimized resources from Minomax and further performance enhancements via cloud-based content delivery. With support for modern compression algorithms such as Brotli and Bzip, Minomax ensures unmatched efficiency, enabling your resources to be lighter, faster, and better optimized for on-premise or cloud-based infrastructures.  

Elevate your web performance, save bandwidth, and deliver an exceptional user experience across all platforms with Minomax—the ultimate optimization solution.  


### Supported Platforms

[![Linux](https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)]()
[![Windows](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)]()
[![Node JS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)]()

---

<p>

<span>
  <a href="https://github.com/cresteem/Minomax/commits/main">
    <img src="https://img.shields.io/github/last-commit/cresteem/Minomax?display_timestamp=committer&style=for-the-badge&label=Updated%20On" alt="GitHub last commit"/>
  </a>
</span>

<span>
  <a href="">
    <img src="https://img.shields.io/github/commit-activity/m/cresteem/Minomax?style=for-the-badge&label=Commit%20Activity" alt="GitHub commit activity"/>
  </a>
</span>

</p>

---

<p>

<span>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/cresteem/Minomax?style=for-the-badge&label=License" alt="GitHub License"/>
  </a>
</span>

<span>
  <a href="https://github.com/cresteem/Minomax/releases">
    <img src="https://img.shields.io/github/v/release/cresteem/Minomax?sort=date&display_name=tag&style=for-the-badge&label=Latest%20Version" alt="GitHub Release"/>
  </a>
</span>

</p>

<p>

<span>
  <a href="https://www.codefactor.io/repository/github/cresteem/Minomax/issues/main">
    <img src="https://img.shields.io/codefactor/grade/github/cresteem/Minomax?style=for-the-badge&label=Code%20Quality%20Grade" alt="CodeFactor Grade"/>
  </a>
</span>

</p>

---

<p>

<span>
  <a href="">
    <img src="https://img.shields.io/npm/d18m/%40cresteem/minomax?style=for-the-badge&label=Downloads%20On%20NPM" alt="NPM Downloads"/>
  </a>
</span>

<span>
  <a href="">
    <img src="https://img.shields.io/github/stars/cresteem/Minomax?style=for-the-badge&label=Stars" alt="GitHub Repo stars"/>
  </a>
</span>

</p>

---

<p>

<span>
  <a href="https://github.com/sponsors/darsan-in">
    <img src="https://img.shields.io/github/sponsors/darsan-in?style=for-the-badge&label=Generous%20Sponsors" alt="GitHub Sponsors"/>
  </a>
</span>

</p>

---

</div>

## Table of Contents 📝

- [Features and Benefits](#features-and-benefits-)
- [Use Cases](#use-cases-)
- [Friendly request to users](#-friendly-request-to-users)

- [Installation - Step-by-Step Guide](#installation---step-by-step-guide-)
- [Usage](#usage)
- [In-Action](#in-action-)

- [License](#license-%EF%B8%8F)
- [Contributing to Our Project](#contributing-to-our-project-)
- [Website](#website-)

- [Contact Information](#contact-information)
- [Credits](#credits-)

## Features and Benefits ✨

* **Image Compression**: [Potential Compression ratio 97%](https://github.com/cresteem/Minomax-Demo?tab=readme-ov-file#image-compression) - Automatically reduce image file sizes without sacrificing quality.
* **Video Compression**: [Potential Compression ratio 93%](https://github.com/cresteem/Minomax-Demo?tab=readme-ov-file#video-compression) - Achieve significant video compression, maintaining quality while reducing file size.
* **Image Set Generation**: Create multiple image sets for different devices, enhancing visual performance across all screens.
* **Web Document Compression**: [Potential Compression ratio 25%](https://github.com/cresteem/Minomax-Demo?tab=readme-ov-file#web-document-compression) Minify and compress JavaScript, HTML, and CSS files for faster load times.
* **Automatic Tag Conversion**: Convert image tags into modern picture tags with media queries, catering to different devices with image sets.
* **Video Thumbnails**: Generate video thumbnails and include them automatically in the HTML video tag, which enhances user engagement and improves SEO by providing rich media previews.
* **Flexible Operation**: Utilize Minomax through an API or a Command Line Interface (CLI), offering flexibility to suit your workflow.


### Changelog 1.0.0 (17/01/2025) [link](https://github.com/cresteem/Minomax/issues/15#issue-2725152450)🛠️  

- **Configuration Updates**:  
  - Switched configuration style from JSON to JS.  
  - Added type support in the configuration file.  
  - Introduced a configuration template initialization command in the CLI.  

- **Optimizations**:  
  - Replaced CSSNano with Lightning CSS for CSS minification.  
  - Enhanced multi-thread processing for IO-blocking operations by increasing UVLib pool size based on system CPU count (utilizing 80% of threads).  

- **Features**:  
  - Added a separate API for video thumbnail generation and linking.  
  - Included a progress bar for all operations.  
  - Enforced configuration files for all API and CLI default parameters to ensure simplicity and consistency.  
  - Updated screen size constants to Tailwind-inspired names like `sm`, `md`, `lg`, and `xl`.  

- **Code Quality**:  
  - Improved code structure using a class-based approach.  
  - Enhanced quality assurance with additional test cases.  

- **UI and Branding**:  
  - Introduced the official Minomax logo.  
  - Added VS Code icon association for the configuration file.  

- **Miscellaneous**:  
  - Filtered out duplicates in video and image encoding, image sets, and web document minification.  
  - Optimized default settings.  
  - Updated dependencies.  
  - Moved selectors renamer to the experimental section.  
  - Print compressed ratios on result.

---  

## Use Cases ✅
* **Optimizing Images**: Compress large image files to speed up your website's load time.
* **Video Compression**: Reduce the size of video files to improve performance without losing quality.
* **Responsive Design**: Generate optimized image sets for various devices, ensuring a seamless experience across all screen sizes.
* **Web Performance**: Minify and compress web documents to enhance your site's speed and reduce bandwidth usage.
* **Dynamic Content Delivery**: Automatically convert and optimize image tags for responsive content delivery.
* **Continuous Integration (CI) Integration**: Incorporate Minomax into your CI pipelines, like GitHub Actions or GitLab CI, for automated optimization during deployment.

---

### 🙏🏻 Friendly Request to Users

Every star on this repository is a sign of encouragement, a vote of confidence, and a reminder that our work is making a difference. If this project has brought value to you, even in the smallest way, **please consider showing your support by giving it a star.** ⭐

_"Star" button located at the top-right of the page, near the repository name._

Your star isn’t just a digital icon—it’s a beacon that tells us we're on the right path, that our efforts are appreciated, and that this work matters. It fuels our passion and drives us to keep improving, building, and sharing.

If you believe in what we’re doing, **please share this project with others who might find it helpful.** Together, we can create something truly meaningful.

Thank you for being part of this journey. Your support means the world to us. 🌍💖

---

## Installation - Step-by-Step Guide 🪜

Follow Below link:

[Getting Started with Minomax](https://minomax.cresteem.com/minomax-getting-started)

## Usage

Everything from top to bottom of Minomax available here - https://minomax.cresteem.com/

## In-Action 🤺

Below reports and compression ratio measured with [Minomax-Demo](https://github.com/cresteem/Minomax-Demo) results, check out - https://github.com/cresteem/Minomax-Demo

**Results Speak 📊**
![minomax result](https://minomax.cresteem.com/report.png)

### Image Compression
* **Original Size**: 43.9 MB
* **Compressed Size**: 1.44 MB
* **Compression Ratio**: 96.72%

![Minomax image compresion result 1](/in-action/result_1.png)

![Minomax image compresion result 2](/in-action/result_2.png)

![Minomax image compresion result 3](/in-action/result_3.png)

### Video Compression
* **Original Size**: 15.2 MB
* **Compressed Size**: 1.04 MB
* **Compression Ratio**: 93.16%

### Web Document Compression
* **Original Size**: 175 KB
* **Compressed Size**: 131 KB
* **Compression Ratio**: 25.14%

## License ©️

This project is licensed under the [Apache License 2.0](LICENSE).

## Contributing to Our Project 🤝

We’re always open to contributions and fixing issues—your help makes this project better for everyone.

If you encounter any errors or issues, please don’t hesitate to [raise an issue](../../issues/new). This ensures we can address problems quickly and improve the project.

For those who want to contribute, we kindly ask you to review our [Contribution Guidelines](CONTRIBUTING) before getting started. This helps ensure that all contributions align with the project's direction and comply with our existing [license](LICENSE).

We deeply appreciate everyone who contributes or raises issues—your efforts are crucial to building a stronger community. Together, we can create something truly impactful.

Thank you for being part of this journey!

## Website 🌐

<a id="url" href="https://minomax.cresteem.com">minomax.cresteem.com</a>

## Contact Information

For any questions, please reach out via connect@cresteem.com

## Credits 🙏🏻

Minomax is an open-source project developed and maintained by [DARSAN](https://darsan.in/) at [CRESTEEM](https://cresteem.com/), a leading web development company.

---

<p align="center">
  <a href="https://cresteem.com/">
    <img src="https://darsan.in/readme-src/branding-gh.png" alt="Cresteem Logo">
  </a>
</p>

---

<p align="center">

<span>
<a href="https://www.instagram.com/cresteem/"><img width='45px' height='45px' src="https://darsan.in/readme-src/footer-icons/insta.png" alt="Cresteem at Instagram"></a>
</span>

<span>
  <img width='20px' height='20px' src="https://darsan.in/readme-src/footer-icons/gap.png" alt="place holder image">
</span>

<span>
<a href="https://www.linkedin.com/company/cresteem/"><img width='45px' height='45px' src="https://darsan.in/readme-src/footer-icons/linkedin.png" alt="Cresteem at Linkedin"></a>
</span>

<span>
  <img width='20px' height='20px' src="https://darsan.in/readme-src/footer-icons/gap.png" alt="place holder image">
</span>

<span>
<a href="https://x.com/cresteem"><img width='45px' height='45px' src="https://darsan.in/readme-src/footer-icons/x.png" alt="Cresteem at Twitter / X"></a>
</span>

<span>
  <img width='20px' height='20px' src="https://darsan.in/readme-src/footer-icons/gap.png" alt="place holder image">
</span>

<span>
<a href="https://www.youtube.com/@Cresteem"><img width='45px' height='45px' src="https://darsan.in/readme-src/footer-icons/youtube.png" alt="Cresteem at Youtube"></a>
</span>

<span>
  <img width='20px' height='20px' src="https://darsan.in/readme-src/footer-icons/gap.png" alt="place holder image">
</span>

<span>
<a href="https://github.com/cresteem"><img width='45px' height='45px' src="https://darsan.in/readme-src/footer-icons/github.png" alt="Cresteem at Github"></a>
</span>

<span>
  <img width='20px' height='20px' src="https://darsan.in/readme-src/footer-icons/gap.png" alt="place holder image">
</span>

<span>
<a href="https://cresteem.com/"><img width='45px' height='45px' src="https://darsan.in/readme-src/footer-icons/website.png" alt="Cresteem Website"></a>
</span>

</p>

---

#### Topics

<ul id="keywords">
  <li>web optimization</li>
  <li>image compression</li>
  <li>video compression</li>
  <li>html minification</li>
  <li>css compression</li>
  <li>responsive design</li>
  <li>content delivery</li>
  <li>speed optimization</li>
  <li>cloud optimization</li>
  <li>compression algorithms</li>
</ul>
