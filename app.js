const puppeteer = require("puppeteer")
const fs = require('fs')
const path = require('path')
const uuid = require('uuid')

const TOTAL_PAGE = 32
let CURRENT_PAGE = 1
const URL = 'http://www.skf-mtusi.ru/?cat=6'
const UPLOAD_DIR = `${__dirname}/uploads/news`
const NEWS_DIR = `${__dirname}/uploads`

const total = []

const parsePage = async (url, pageId) => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.setViewport({
    width: 1366,
    height: 768,
    deviceScaleFactor: 1
  })
  await page.goto(`${url}&paged=${pageId}`, {waitUntil: 'networkidle2'})

  const previewData = await page.evaluate(() => {
    const parsed = []
    const posts = document.querySelectorAll('.post')
    for (const post of posts) {
      const title = post.querySelector('.entry>h1>a')?.innerText
      const annonce = post.querySelector('.entry>p')?.innerText.replace(/Читать полностью/ig,'')
      const preview = post.querySelector('.entry>div>img')?.src
      const fullContentURL = post.querySelector('.entry>h1>a').href
      parsed.push({
        title, 
        annonce, 
        preview, 
        fullContentURL})
    }
    return parsed
  })

  for (const obj of previewData) {
    await page.goto(obj.fullContentURL, {waitUntil: 'networkidle2'})
    delete obj.fullContentURL
    Object.assign(obj, await page.evaluate(() => {
      const content = document.querySelector('.entry>p')?.innerText
      const photos = [...document.querySelectorAll('.post>center>a>img')].map(img => img.src)
      return {
        content,
        photos: photos.length === 0 ? null : photos
      }
    }))
    const previewBuffer = await page.goto(obj.preview, {waitUntil: 'networkidle2'})
    let previewFilename = uuid.v4()
    const downloadedPreview = await previewBuffer.buffer()
    console.log(`Download preview ${obj.preview} with size ${downloadedPreview.length}`)
    if (downloadedPreview.length > 1000) {
      fs.writeFileSync(`${UPLOAD_DIR}/${previewFilename}.jpg`, downloadedPreview)
      obj.preview = `./uploads/news/${previewFilename}.jpg`
    } else {
      obj.preview = null
    }
    
    if (obj.photos) {
      for (let i = 0; i < obj.photos; i++) {
        const photoBuffer = await page.goto(obj.photos[i], { waitUntil: 'networkidle2' })
        let photoFilename = uuid.v4()
        const downloadedPhoto = await photoBuffer.buffer()
        console.log(`Download photo ${obj.photos[i]} with size ${downloadedPhoto.length}`)
        if (downloadedPhoto.length > 1000) {
          fs.writeFileSync(`${UPLOAD_DIR}/${photoFilename}.jpg`, downloadedPhoto)
          obj.photos[i] = `./uploads/news/${photoFilename}.jpg`
        } else {
          obj.photos[i] = null
        }
      }
    }
  }

  await browser.close()
  return previewData
}


const makeBeautiful = async (currentPage, totalPage) => {
  console.log('Парсинг пошел!')
  while (currentPage <= totalPage) {
    await parsePage(URL, currentPage).then(res => {
      total.push(...res)
    })
    
    currentPage++
    console.clear()
    console.log('Завершено на '+Math.floor((currentPage / totalPage) * 100) + '%')
  }

  return total
}

makeBeautiful(CURRENT_PAGE, TOTAL_PAGE).then(res => {
  fs.writeFileSync(`${NEWS_DIR}/news.json`, JSON.stringify(res))
})