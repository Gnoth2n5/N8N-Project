// --- Helper ---
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// --- LẤY LINK ĐẦU VÀO ---
let baseUrl = $json.Url?.trim();
if (!baseUrl) throw new Error("❌ Thiếu 'Url' trong input!");

let major = $json.Major || $json.major || ""; // fallback nếu có

// 🟩 GIỚI HẠN ĐỂ TRÁNH CRAWL QUÁ NHIỀU
const MAX_PAGES = parseInt($json.MaxPages || $json.maxPages || "5"); // Mặc định 5 trang
const MAX_JOBS = parseInt($json.MaxJobs || $json.maxJobs || "200"); // Mặc định 200 job

let allJobs = [];
let currentPage = 1;

while (true) {
  // --- TẠO LINK PHÂN TRANG ---
  let Url = baseUrl;
  if (currentPage > 1) {
    Url = baseUrl.includes("?")
      ? `${baseUrl}&page=${currentPage}`
      : `${baseUrl}?page=${currentPage}`;
  }

  console.log(`🟦 Đang xử lý trang ${currentPage}: ${Url}`);

  // --- ĐI ĐẾN TRANG ---
  await $page.goto(Url, { waitUntil: "domcontentloaded", timeout: 30000 }); // Giảm timeout xuống 30s

  // --- ĐỢI JOB HIỆN RA ---
  try {
    await $page.waitForSelector(".view_job_item h2 a", { timeout: 15000 });
  } catch {
    console.log(`⚠️ Không thấy job ở trang ${currentPage}, dừng lại.`);
    break;
  }

  // --- CUỘN ĐỂ LOAD HẾT JOB ---
  let lastCount = 0;
  let noChangeCount = 0; // Đếm số lần không thay đổi liên tiếp
  for (let i = 0; i < 10; i++) {
    // Giảm từ 15 xuống 10
    await $page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await sleep(500); // Giảm từ 1200ms xuống 500ms
    const currentCount = await $page.$$eval(
      ".view_job_item",
      (els) => els.length
    );
    if (currentCount === lastCount) {
      noChangeCount++;
      if (noChangeCount >= 2) break; // Nếu 2 lần liên tiếp không thay đổi thì dừng
    } else {
      noChangeCount = 0; // Reset counter nếu có thay đổi
    }
    lastCount = currentCount;
  }

  // --- LẤY DỮ LIỆU ---
  const jobsOnPage = await $page.evaluate(() => {
    const jobItems = document.querySelectorAll(".view_job_item");
    return Array.from(jobItems).map((item) => {
      const titleEl = item.querySelector("h2 a[href]");
      return {
        Url: titleEl ? titleEl.href : "",
      };
    });
  });

  console.log(`✅ Trang ${currentPage} có ${jobsOnPage.length} job`);
  if (jobsOnPage.length === 0) break;

  // --- GẮN SOURCE + MAJOR ---
  const mappedJobs = jobsOnPage.map((j) => ({
    Source: baseUrl,
    Url: j.Url,
    Major: major,
  }));

  allJobs.push(...mappedJobs);

  // 🟩 KIỂM TRA GIỚI HẠN SỐ LƯỢNG JOB
  if (allJobs.length >= MAX_JOBS) {
    console.log(`🛑 Đã đạt giới hạn ${MAX_JOBS} job, dừng lại!`);
    allJobs = allJobs.slice(0, MAX_JOBS); // Cắt bớt nếu vượt quá
    break;
  }

  // 🟩 KIỂM TRA GIỚI HẠN SỐ TRANG
  if (currentPage >= MAX_PAGES) {
    console.log(`🛑 Đã đạt giới hạn ${MAX_PAGES} trang, dừng lại!`);
    break;
  }

  // --- KIỂM TRA XEM CÒN TRANG KHÔNG ---
  const nextExists = await $page.$("ul.pagination li.active + li button");
  if (!nextExists) {
    console.log("🛑 Hết trang, dừng!");
    break;
  }

  currentPage++;
  await sleep(800); // Giảm từ 1500ms xuống 800ms
}

console.log("🎯 Tổng số việc làm:", allJobs.length);
return allJobs;
