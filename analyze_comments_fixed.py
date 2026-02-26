
#!/usr/bin/env python3
import json
import sys
import re
from collections import Counter

def extract_comments_from_json(filename):
    """Extract all comments from Facebook Graph API response"""
    comments = []
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Parse JSON
        data = json.loads(content)
        
        # Extract comments from posts
        for post in data.get('data', []):
            post_comments = post.get('comments', {}).get('data', [])
            for comment in post_comments:
                msg = comment.get('message', '').strip()
                if msg:
                    comments.append({
                        'message': msg,
                        'from': comment.get('from', {}).get('name', 'Unknown'),
                        'created_time': comment.get('created_time', '')
                    })
        
        return comments
    
    except json.JSONDecodeError as e:
        print(f"JSON Error: {e}")
        print("\nTrying alternative parsing...")
        return []
    except Exception as e:
        print(f"Error: {e}")
        return []

def analyze_keywords(comments):
    """Analyze and count keywords from comments"""
    
    # รวมข้อความทั้งหมด
    all_messages = [c['message'].lower() for c in comments]
    full_text = ' '.join(all_messages)
    
    # แยกคำ (Thai + English)
    # Thai: \u0E00-\u0E7F
    # English: a-zA-Z
    words = re.findall(r'[\u0E00-\u0E7F]+|[a-zA-Z]+', full_text)
    
    # นับคำที่ปรากฏบ่อย
    word_counts = Counter(words)
    
    # คำที่ไม่สำคัญ (stop words)
    stop_words = {
        'ครับ', 'ค่ะ', 'คะ', 'นะ', 'จ้า', 'จ๊ะ', 'ๆ',
        'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are',
        'ใน', 'ของ', 'ที่', 'เป็น', 'มี', 'ได้', 'แล้ว', 'จะ',
        'กับ', 'ให้', 'ไป', 'มา', 'ไม่', 'ว่า', 'ก็', 'ถ้า'
    }
    
    # กรองคำที่ไม่สำคัญ
    filtered_counts = {word: count for word, count in word_counts.items() 
                      if word not in stop_words and len(word) > 1}
    
    return word_counts, filtered_counts, all_messages

def main():
    filename = 'page_comments.json'
    
    print("=" * 70)
    print("📊 FACEBOOK COMMENTS ANALYSIS")
    print("=" * 70)
    print(f"\nAnalyzing: {filename}\n")
    
    # Extract comments
    comments = extract_comments_from_json(filename)
    
    if not comments:
        print("❌ No comments found or error reading file")
        return
    
    print(f"✅ Found {len(comments)} comments\n")
    
    # Analyze keywords
    all_words, filtered_words, messages = analyze_keywords(comments)
    
    # Display results
    print("=" * 70)
    print("🔥 TOP 30 MOST FREQUENT KEYWORDS (Filtered)")
    print("=" * 70)
    print(f"{'Keyword':<30} | {'Count':>6} | {'%':>6}")
    print("-" * 70)
    
    total_filtered = sum(filtered_words.values())
    for word, count in sorted(filtered_words.items(), key=lambda x: x[1], reverse=True)[:30]:
        percentage = (count / total_filtered * 100) if total_filtered > 0 else 0
        print(f"{word:<30} | {count:>6} | {percentage:>5.1f}%")
    
    print("\n" + "=" * 70)
    print("📊 STATISTICS")
    print("=" * 70)
    print(f"Total comments       : {len(comments)}")
    print(f"Total words          : {len(all_words)}")
    print(f"Unique words         : {len(all_words.keys())}")
    print(f"Filtered unique words: {len(filtered_words)}")
    
    # Show sample comments
    print("\n" + "=" * 70)
    print("📝 SAMPLE COMMENTS (Latest 10)")
    print("=" * 70)
    for i, comment in enumerate(comments[:10], 1):
        print(f"\n{i}. {comment['from']}")
        print(f"   {comment['message']}")
        print(f"   ({comment['created_time']})")
    
    # Detect encouragement keywords
    print("\n" + "=" * 70)
    print("💪 ENCOURAGEMENT KEYWORDS DETECTED")
    print("=" * 70)
    
    encouragement_keywords = [
        'สู้', 'กำลังใจ', 'เชียร์', 'ฮึบ', 'สุดยอด', 'เยี่ยม', 
        'ดี', 'เก่ง', 'รัก', 'ชอบ', 'fighting', 'cheer', 'great', 'good'
    ]
    
    found_encouragement = {}
    for keyword in encouragement_keywords:
        count = sum(1 for msg in messages if keyword in msg)
        if count > 0:
            found_encouragement[keyword] = count
    
    if found_encouragement:
        for word, count in sorted(found_encouragement.items(), key=lambda x: x[1], reverse=True):
            print(f"{word:<20} : {count:>4} times")
    else:
        print("No encouragement keywords detected")

if __name__ == '__main__':
    main()

