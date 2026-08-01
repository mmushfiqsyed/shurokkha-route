from crewai.tools import tool
import yfinance as yf

@tool('Get Stock Data')
def get_stock_data(ticker:str) -> str:
    """Get current price and recent news for a given stock ticker symbol."""
    stock = yf.Ticker(ticker)
    
    info = stock.info
    current_price = info.get('currentPrice', 'N/A')
    previous_close = info.get('previousClose', 'N/A')
    
    if current_price != 'N/A' and previous_close != 'N/A':
        pct_change = ((current_price - previous_close)/previous_close)*100
        price_info = f'Price {current_price:.2f} ({pct_change:+.2f})'
        
    else:
        price_info = 'Price information not available'
        
    news = stock.news
    headlines = []
    
    for news_item in news[:8]:
        title = news_item['content'].get('title', '').strip()
        
        if title:
            headlines.append(f'- {title}')
            
    if not headlines:
        headlines.append('- No recent news available')
        
    news_text = '\n'.join(headlines)
    
    return f'{price_info}\n\nRecent News:\n{news_text}'
