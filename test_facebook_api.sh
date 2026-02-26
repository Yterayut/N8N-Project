#!/bin/bash
# Facebook Page API Testing - curl Commands
# สำหรับทดสอบทั้ง 3 เพจ
# ✅ แก้ไข: ลบช่องว่างออกจาก Token แล้ว

# ========================================
# 🎯 เลือกเพจที่ต้องการทดสอบ
# ========================================

# เพจที่ 1: ความสุขนักวิ่ง
PAGE_1_NAME="ความสุขนักวิ่ง"
PAGE_1_ID="840212645843493"
PAGE_1_TOKEN="EAAQddpxLxgIBPxOmRQqCutYFGxjygyfIcDKu59BZAuZBqPXqyL2v88ZARok0cYr4BQRrmWgmy1PzbhZCMdgu977jUuZCsbJYzyxbE407wTGYdKrZBhwAojcBvxOZCei"

# เพจที่ 2: จีรศักดิ์ล่ายทอด (แก้ไขแล้ว - ลบช่องว่างหลัง UZBY)
PAGE_2_NAME="จีรศักดิ์ล่ายทอด"
PAGE_2_ID="889083480945134"
PAGE_2_TOKEN="EAAQddpxLxgIBPZCSgcWeY0uieTYLi2AZBQMMasbZCFphH6Jgw5m6N5oBvrlYgxp6psrfEceKPZB9UZBYdQGS5NE0EvPAilwcuKx1hSL7eWtB8we1z0RE5JBvXK5N8g"

# เพจที่ 3: พชร จันทรรวงทอง (แก้ไขแล้ว - ลบช่องว่างหลัง YlyE)
PAGE_3_NAME="พชร จันทรรวงทอง"
PAGE_3_ID="102450935821483"
PAGE_3_TOKEN="EAAQddpxLxgIBP2EcuiMy253ZCCCRHA8iLglhVzdDubmeVRpBWpxNnBz86JLCLkCleZBZCqsPvaroW7h307vGQVRkx2U14ZAXhvGxYlyEYlp8BsGtZCZczi1ZCCJt8EDWkB1"

# เลือกเพจที่ต้องการทดสอบ (1, 2, หรือ 3)
SELECTED_PAGE=1

# ตั้งค่าตามเพจที่เลือก
if [ $SELECTED_PAGE -eq 1 ]; then
    PAGE_NAME=$PAGE_1_NAME
    PAGE_ID=$PAGE_1_ID
    TOKEN=$PAGE_1_TOKEN
elif [ $SELECTED_PAGE -eq 2 ]; then
    PAGE_NAME=$PAGE_2_NAME
    PAGE_ID=$PAGE_2_ID
    TOKEN=$PAGE_2_TOKEN
else
    PAGE_NAME=$PAGE_3_NAME
    PAGE_ID=$PAGE_3_ID
    TOKEN=$PAGE_3_TOKEN
fi

API_VERSION="v24.0"
BASE_URL="https://graph.facebook.com/$API_VERSION"

# ========================================
# 🎨 สี Terminal
# ========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ========================================
# 📝 Helper Functions
# ========================================

print_header() {
    echo ""
    echo "======================================================================"
    echo -e "${BLUE}  $1${NC}"
    echo "======================================================================"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# ========================================
# ✅ ทดสอบ 1: ตรวจสอบ Page Access Token
# ========================================

test_token() {
    print_header "🔍 ทดสอบ 1: ตรวจสอบ Page Access Token"
    echo "📄 เพจ: $PAGE_NAME"
    echo "🆔 Page ID: $PAGE_ID"
    echo ""
    
    print_info "กำลังตรวจสอบ Token..."
    
    curl -s -X GET "$BASE_URL/me" \
        -d "access_token=$TOKEN" \
        -d "fields=id,name,category,fan_count" \
        | python3 -m json.tool
}

# ========================================
# ✅ ทดสอบ 2: ดึงโพสต์ทั้งหมด
# ========================================

get_posts() {
    print_header "📋 ทดสอบ 2: ดึงโพสต์ทั้งหมด"
    
    print_info "กำลังดึงโพสต์ล่าสุด 10 โพสต์..."
    
    curl -s -X GET "$BASE_URL/$PAGE_ID/posts" \
        -d "access_token=$TOKEN" \
        -d "fields=id,message,created_time,comments.limit(5){id,message,from},likes.summary(true)" \
        -d "limit=10" \
        | python3 -m json.tool
}

# ========================================
# ✅ ทดสอบ 3: ดึงคอมเมนต์ของโพสต์
# ========================================

get_comments() {
    print_header "💬 ทดสอบ 3: ดึงคอมเมนต์ของโพสต์"
    
    if [ -z "$1" ]; then
        print_error "กรุณาระบุ POST_ID"
        echo "ตัวอย่าง: get_comments POST_ID"
        return
    fi
    
    POST_ID=$1
    print_info "กำลังดึงคอมเมนต์ของโพสต์: $POST_ID"
    
    curl -s -X GET "$BASE_URL/$POST_ID/comments" \
        -d "access_token=$TOKEN" \
        -d "fields=id,message,from,created_time,like_count" \
        -d "limit=50" \
        | python3 -m json.tool
}

# ========================================
# ✅ ทดสอบ 4: ตอบคอมเมนต์
# ========================================

reply_comment() {
    print_header "📤 ทดสอบ 4: ตอบคอมเมนต์"
    
    if [ -z "$1" ] || [ -z "$2" ]; then
        print_error "กรุณาระบุ COMMENT_ID และ MESSAGE"
        echo "ตัวอย่าง: reply_comment COMMENT_ID \"ข้อความตอบกลับ\""
        return
    fi
    
    COMMENT_ID=$1
    MESSAGE=$2
    
    print_info "กำลังตอบคอมเมนต์: $COMMENT_ID"
    print_info "ข้อความ: $MESSAGE"
    
    curl -s -X POST "$BASE_URL/$COMMENT_ID/comments" \
        -d "access_token=$TOKEN" \
        -d "message=$MESSAGE" \
        | python3 -m json.tool
}

# ========================================
# ✅ ทดสอบ 5: สร้างโพสต์ทดสอบ
# ========================================

create_post() {
    print_header "📝 ทดสอบ 5: สร้างโพสต์ทดสอบ"
    
    MESSAGE=${1:-"🧪 โพสต์ทดสอบระบบตอบคอมเมนต์อัตโนมัติ

สวัสดีครับ! นี่คือโพสต์ทดสอบระบบ Bot ตอบคอมเมนต์อัตโนมัติ

ลองคอมเมนต์ด้วยคำเหล่านี้:
• \"ราคา\" - ดูราคาสินค้า
• \"สั่ง\" - วิธีสั่งซื้อ
• \"เปิด\" - เวลาเปิด-ปิด
• \"ที่อยู่\" - ดูที่ตั้ง

Bot จะตอบกลับอัตโนมัติครับ! 🤖

⏰ เวลาทดสอบ: $(date '+%d/%m/%Y %H:%M:%S')"}
    
    print_info "กำลังสร้างโพสต์..."
    
    curl -s -X POST "$BASE_URL/$PAGE_ID/feed" \
        -d "access_token=$TOKEN" \
        --data-urlencode "message=$MESSAGE" \
        | python3 -m json.tool
}

# ========================================
# ✅ ทดสอบ 6: ดู Page Insights
# ========================================

get_insights() {
    print_header "📊 ทดสอบ 6: ดู Page Insights"
    
    print_info "กำลังดึงข้อมูล Insights..."
    
    curl -s -X GET "$BASE_URL/$PAGE_ID/insights" \
        -d "access_token=$TOKEN" \
        -d "metric=page_impressions,page_engaged_users" \
        | python3 -m json.tool
}

# ========================================
# ✅ รันทดสอบทั้งหมด
# ========================================

run_all_tests() {
    print_header "🧪 รันการทดสอบทั้งหมด"
    echo "📄 เพจ: $PAGE_NAME"
    echo "🆔 Page ID: $PAGE_ID"
    echo ""
    
    # ทดสอบ 1: Token
    test_token
    echo ""
    read -p "กด Enter เพื่อดำเนินการต่อ..."
    
    # ทดสอบ 2: โพสต์
    get_posts
    echo ""
    read -p "กด Enter เพื่อดำเนินการต่อ..."
    
    # ทดสอบ 5: สร้างโพสต์
    create_post
    echo ""
    
    print_success "การทดสอบเสร็จสมบูรณ์!"
}

# ========================================
# 📖 แสดงคำแนะนำ
# ========================================

show_help() {
    echo "======================================================================"
    echo "  📖 Facebook Page API Testing - คู่มือการใช้งาน"
    echo "======================================================================"
    echo ""
    echo "วิธีใช้งาน:"
    echo ""
    echo "1. ตรวจสอบ Token:"
    echo "   ./test_facebook_api.sh test_token"
    echo ""
    echo "2. ดึงโพสต์ทั้งหมด:"
    echo "   ./test_facebook_api.sh get_posts"
    echo ""
    echo "3. ดึงคอมเมนต์ของโพสต์:"
    echo "   ./test_facebook_api.sh get_comments POST_ID"
    echo ""
    echo "4. ตอบคอมเมนต์:"
    echo "   ./test_facebook_api.sh reply_comment COMMENT_ID \"ข้อความตอบกลับ\""
    echo ""
    echo "5. สร้างโพสต์ทดสอบ:"
    echo "   ./test_facebook_api.sh create_post"
    echo ""
    echo "6. ดู Page Insights:"
    echo "   ./test_facebook_api.sh get_insights"
    echo ""
    echo "7. รันทดสอบทั้งหมด:"
    echo "   ./test_facebook_api.sh run_all_tests"
    echo ""
    echo "======================================================================"
}

# ========================================
# 🚀 เริ่มต้น
# ========================================

if [ $# -eq 0 ]; then
    show_help
else
    case "$1" in
        test_token)
            test_token
            ;;
        get_posts)
            get_posts
            ;;
        get_comments)
            get_comments "$2"
            ;;
        reply_comment)
            reply_comment "$2" "$3"
            ;;
        create_post)
            create_post "$2"
            ;;
        get_insights)
            get_insights
            ;;
        run_all_tests)
            run_all_tests
            ;;
        *)
            print_error "คำสั่งไม่ถูกต้อง"
            show_help
            ;;
    esac
fi
