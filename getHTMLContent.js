// 🟩 Script Puppeteer để lấy phần body của website
// Sử dụng trong n8n Puppeteer node với operation: runCustomScript

// 🟩 Lấy URL từ input JSON
const url = $json.url || $json.Url || $json.link || $json.Link;

if (!url) {
  throw new Error(
    "❌ Thiếu URL trong input! Cần có field: url, Url, link hoặc Link"
  );
}

// 🟩 Tối ưu: Chặn request không cần thiết để tăng tốc
await $page.setRequestInterception(true);
$page.on("request", (req) => {
  const resourceType = req.resourceType();
  const requestUrl = req.url();

  // Chặn images, fonts, media để tăng tốc
  if (["image", "font", "media"].includes(resourceType)) {
    return req.abort();
  }

  // Chặn các script tracking/analytics
  if (
    /doubleclick|googletagmanager|analytics|facebook|adsystem|adservice|hotjar|mixpanel/i.test(
      requestUrl
    )
  ) {
    return req.abort();
  }

  req.continue();
});

// 🟩 Truy cập trang
await $page.goto(url, {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});

// 🟩 Đợi body load xong
try {
  await $page.waitForSelector("body", { timeout: 15000 });
} catch (e) {
  console.log("⚠️ Không tìm thấy body, tiếp tục...");
}

// 🟩 Cuộn để load hết nội dung động (nếu có)
await $page.evaluate(async () => {
  await new Promise((resolve) => {
    let totalHeight = 0;
    const distance = 500;
    const timer = setInterval(() => {
      const scrollHeight = document.body.scrollHeight;
      window.scrollBy(0, distance);
      totalHeight += distance;

      if (totalHeight >= scrollHeight) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
});

// 🟩 Lấy HTML của body
const bodyHTML = await $page.evaluate(() => {
  return document.body.innerHTML;
});

// 🟩 Lấy text content của body (nếu cần)
const bodyText = await $page.evaluate(() => {
  return document.body.innerText || document.body.textContent;
});

// 🟩 Trả về kết quả
return [
  {
    json: {
      url: url,
      bodyHTML: bodyHTML,
      bodyText: bodyText,
      bodyLength: bodyHTML.length,
      textLength: bodyText.length,
    },
  },
];
