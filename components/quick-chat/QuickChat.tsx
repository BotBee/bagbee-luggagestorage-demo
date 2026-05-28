import Script from 'next/script'

const QuickChatScript = () => (
  <Script id='quickchat' strategy='afterInteractive'>
    {`
      (function(e,a,d,i,c,t=a.createElement(d)){
        e[c]=e[c]||function(){
          (e[c].q=e[c].q||[]).push(arguments)
        },
        t.src=i,
        t.async=1,
        a.body.insertAdjacentElement("beforeend",t)
      })(window,document,"script","https://widget.quickchat.ai/chat.js","_quickchat");
      _quickchat("host", "app.quickchat.ai");
      _quickchat("init", "0hxkj3kc1e");
    `}
  </Script>
)

export default QuickChatScript
