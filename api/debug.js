// api/debug.js — TEMPORAL
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(200).json({
    emailjs_service:  !!process.env.VITE_EMAILJS_SERVICE_ID,
    emailjs_template: !!process.env.VITE_EMAILJS_TEMPLATE_ID,
    emailjs_key:      !!process.env.VITE_EMAILJS_PUBLIC_KEY,
    service_preview:  (process.env.VITE_EMAILJS_SERVICE_ID  || '').substring(0, 8) + '...',
    template_preview: (process.env.VITE_EMAILJS_TEMPLATE_ID || '').substring(0, 9) + '...',
  })
}
