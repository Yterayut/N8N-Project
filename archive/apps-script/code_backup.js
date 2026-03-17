// WARNING:
// This file is a legacy snapshot / backup reference.
// It is NOT the runtime source of truth for PAY production behavior.
// Canonical Apps Script source lives under:
//   apps-script/pay-finance/Code.js
// Before using this file for recovery or comparison, verify against:
//   - deployed Apps Script
//   - canonical Sheet schema
//   - n8n live workflow/runtime
//
// กำหนดค่าคงที่
const SPREADSHEET_ID = '1ptHPEg2d_19vbecMjzZga2ETJu3ARfuS6LLomYhyIds';
const SHEET_NAME = 'Sheet1';

// ฟังก์ชันสำหรับแสดงหน้า Web App
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('My Finance App')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ดึงข้อมูลสรุปภาพรวม (Dashboard)
function getDashboardData(month, year) {
  try {
    Logger.log('getDashboardData called: month=' + month + ', year=' + year);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return { success: false, error: 'ไม่พบ Sheet: ' + SHEET_NAME };
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return {
        success: true,
        balance: 0,
        income: 0,
        expense: 0,
        categoryExpenses: {},
        categoryPercentages: {},
        recentTransactions: []
      };
    }
    
    const filteredData = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      try {
        const date = new Date(row[0]);
        const rowMonth = date.getMonth() + 1;
        const rowYear = date.getFullYear();
        
        if (rowMonth === parseInt(month) && rowYear === parseInt(year)) {
          filteredData.push(row);
        }
      } catch (e) {
        Logger.log('Error parsing date row ' + i + ': ' + e);
      }
    }
    
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryExpenses = {};
    const recentTransactions = [];
    
    filteredData.forEach((row) => {
      try {
        const type = String(row[2]).toLowerCase();
        const amount = parseFloat(row[3]) || 0;
        const category = String(row[4] || 'อื่นๆ');
        const date = row[0];
        const time = String(row[1] || '');
        
        if (type === 'income') {
          totalIncome += amount;
        } else if (type === 'expense') {
          totalExpense += amount;
          
          if (!categoryExpenses[category]) {
            categoryExpenses[category] = 0;
          }
          categoryExpenses[category] += amount;
        }
        
        recentTransactions.push({
          date: Utilities.formatDate(new Date(date), 'GMT+7', 'dd/MM/yyyy'),
          time: time,
          type: type,
          amount: amount,
          category: category
        });
      } catch (e) {
        Logger.log('Error processing row: ' + e);
      }
    });
    
    recentTransactions.sort((a, b) => {
      try {
        const dateA = new Date(a.date.split('/').reverse().join('-'));
        const dateB = new Date(b.date.split('/').reverse().join('-'));
        return dateB - dateA;
      } catch (e) {
        return 0;
      }
    });
    
    const topTransactions = recentTransactions.slice(0, 5);
    
    const categoryPercentages = {};
    Object.keys(categoryExpenses).forEach(cat => {
      categoryPercentages[cat] = totalExpense > 0 ? 
        Math.round((categoryExpenses[cat] / totalExpense) * 100) : 0;
    });
    
    return {
      success: true,
      balance: totalIncome - totalExpense,
      income: totalIncome,
      expense: totalExpense,
      categoryExpenses: categoryExpenses,
      categoryPercentages: categoryPercentages,
      recentTransactions: topTransactions
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    return { success: false, error: error.message };
  }
}

// ดึงรายการทั้งหมด (Transaction List)
function getAllTransactions(filters) {
  try {
    Logger.log('getAllTransactions called');
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return { success: false, error: 'ไม่พบ Sheet' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return { success: true, transactions: [] };
    }
    
    const transactions = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      try {
        const date = new Date(row[0]);
        const type = String(row[2]).toLowerCase();
        const amount = parseFloat(row[3]) || 0;
        const category = String(row[4] || 'อื่นๆ');
        
        let includeRow = true;
        
        if (filters) {
          if (filters.type && filters.type !== 'all' && type !== filters.type) {
            includeRow = false;
          }
          
          if (filters.category && filters.category !== 'all' && category !== filters.category) {
            includeRow = false;
          }
          
          if (filters.startDate) {
            const startDate = new Date(filters.startDate);
            if (date < startDate) includeRow = false;
          }
          
          if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59);
            if (date > endDate) includeRow = false;
          }
          
          if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            const searchableText = (category + ' ' + row[5] + ' ' + row[7]).toLowerCase();
            if (!searchableText.includes(searchTerm)) {
              includeRow = false;
            }
          }
        }
        
        if (includeRow) {
          transactions.push({
            index: i - 1,
            date: Utilities.formatDate(date, 'GMT+7', 'dd/MM/yyyy'),
            time: String(row[1] || ''),
            type: type,
            amount: amount,
            category: category,
            senderName: String(row[5] || ''),
            senderBank: String(row[6] || '')
          });
        }
      } catch (e) {
        Logger.log('Error processing row ' + i + ': ' + e);
      }
    }
    
    transactions.sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('-'));
      const dateB = new Date(b.date.split('/').reverse().join('-'));
      return dateB - dateA;
    });
    
    return { success: true, transactions: transactions };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    return { success: false, error: error.message };
  }
}

// ลบรายการ
function deleteTransaction(index) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return { success: false, error: 'ไม่พบ Sheet' };
    }
    
    sheet.deleteRow(index + 2);
    
    return { success: true, message: 'ลบรายการสำเร็จ' };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ดึงข้อมูลสถิติ
function getStatisticsData(year) {
  try {
    Logger.log('getStatisticsData for year: ' + year);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return { success: false, error: 'ไม่พบ Sheet' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return {
        success: true,
        monthlyData: [],
        yearlyTotal: { income: 0, expense: 0, balance: 0 },
        topCategories: []
      };
    }
    
    const monthlyData = {};
    for (let m = 1; m <= 12; m++) {
      monthlyData[m] = { income: 0, expense: 0 };
    }
    
    const categoryTotals = {};
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      try {
        const date = new Date(row[0]);
        const rowYear = date.getFullYear();
        
        if (rowYear !== parseInt(year)) continue;
        
        const month = date.getMonth() + 1;
        const type = String(row[2]).toLowerCase();
        const amount = parseFloat(row[3]) || 0;
        const category = String(row[4] || 'อื่นๆ');
        
        if (type === 'income') {
          monthlyData[month].income += amount;
        } else if (type === 'expense') {
          monthlyData[month].expense += amount;
          
          if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
          }
          categoryTotals[category] += amount;
        }
      } catch (e) {
        Logger.log('Error: ' + e);
      }
    }
    
    const monthlyArray = [];
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
                        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    
    for (let m = 1; m <= 12; m++) {
      monthlyArray.push({
        month: m,
        monthName: monthNames[m - 1],
        income: monthlyData[m].income,
        expense: monthlyData[m].expense,
        balance: monthlyData[m].income - monthlyData[m].expense
      });
    }
    
    const yearlyTotal = {
      income: monthlyArray.reduce((sum, m) => sum + m.income, 0),
      expense: monthlyArray.reduce((sum, m) => sum + m.expense, 0)
    };
    yearlyTotal.balance = yearlyTotal.income - yearlyTotal.expense;
    
    const topCategories = Object.keys(categoryTotals)
      .map(cat => ({ category: cat, amount: categoryTotals[cat] }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    
    return {
      success: true,
      monthlyData: monthlyArray,
      yearlyTotal: yearlyTotal,
      topCategories: topCategories
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    return { success: false, error: error.message };
  }
}

// ดึงหมวดหมู่ทั้งหมด
function getUniqueCategories() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return { success: false, error: 'ไม่พบ Sheet' };
    }
    
    const data = sheet.getDataRange().getValues();
    const categories = new Set();
    
    for (let i = 1; i < data.length; i++) {
      const category = String(data[i][4] || '');
      if (category) {
        categories.add(category);
      }
    }
    
    return {
      success: true,
      categories: Array.from(categories).sort()
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ดึงข้อมูลผู้ใช้
function getUserInfo() {
  try {
    const user = Session.getEffectiveUser().getEmail();
    let userName = 'User';
    
    if (user) {
      userName = user.split('@')[0];
    }
    
    return {
      success: true,
      email: user || 'unknown',
      displayName: userName
    };
  } catch (error) {
    return {
      success: true,
      email: 'user@example.com',
      displayName: 'User'
    };
  }
}

// ดึงหมวดหมู่
function getCategories() {
  return {
    income: [
      { icon: '💰', name: 'เงินเดือน', value: 'Salary' },
      { icon: '💼', name: 'โบนัส', value: 'Bonus' },
      { icon: '📈', name: 'ลงทุน', value: 'Investment' },
      { icon: '🎁', name: 'ของขวัญ', value: 'Gift' },
      { icon: '➕', name: 'อื่นๆ', value: 'Other Income' }
    ],
    expense: [
      { icon: '🍔', name: 'อาหาร', value: 'Food' },
      { icon: '🚗', name: 'เดินทาง', value: 'Transport' },
      { icon: '🏠', name: 'บ้าน', value: 'Home' },
      { icon: '🎮', name: 'บันเทิง', value: 'Entertainment' },
      { icon: '💊', name: 'สุขภาพ', value: 'Health' },
      { icon: '🛒', name: 'ช้อปปิ้ง', value: 'Shopping' },
      { icon: '💡', name: 'ค่าบิล', value: 'Bills' },
      { icon: '➕', name: 'อื่นๆ', value: 'Other' }
    ],
    transfer: [
      { icon: '🔄', name: 'โอนภายใน', value: 'Internal Move' },
      { icon: '🏦', name: 'โอนธนาคาร', value: 'Transfer' }
    ]
  };
}
