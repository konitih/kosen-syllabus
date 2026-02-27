import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/syllabus
 * Fetches and parses syllabus data using FireCrawl API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolName, department, grade, semester, syllabusUrl } = body;

    // Get FireCrawl API key from environment
    const apiKey = process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { subjects: [], errors: ['FireCrawl API キーが設定されていません'] },
        { status: 400 }
      );
    }

    // Construct search parameters for the syllabus site
    const searchParams = new URLSearchParams({
      school: schoolName,
      department,
      grade: grade.toString(),
      semester,
    });

    const targetUrl = `${syllabusUrl}?${searchParams.toString()}`;

    // Call FireCrawl API to scrape the syllabus site
    const crawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ['markdown'],
      }),
    });

    if (!crawlResponse.ok) {
      const error = await crawlResponse.text();
      console.error('[v0] FireCrawl error:', error);
      return NextResponse.json(
        {
          subjects: [],
          errors: [
            'シラバスの取得に失敗しました。サーバー管理者に連絡してください。',
          ],
        },
        { status: crawlResponse.status }
      );
    }

    const crawlData = await crawlResponse.json();

    // Parse the markdown content to extract subject information
    const markdown = crawlData.markdown || crawlData.data?.markdown || '';
    
    if (!markdown) {
      return NextResponse.json(
        { subjects: [], errors: ['シラバスコンテンツを取得できませんでした'] },
        { status: 200 }
      );
    }

    // Extract subjects from markdown
    const subjects = parseMarkdownToSubjects(
      markdown,
      semester,
      new Date().getFullYear()
    );

    return NextResponse.json({
      subjects,
      errors: subjects.length === 0 ? ['科目を抽出できませんでした'] : [],
    });
  } catch (error) {
    console.error('[v0] Syllabus API error:', error);
    return NextResponse.json(
      {
        subjects: [],
        errors: [
          error instanceof Error ? error.message : '不明なエラーが発生しました',
        ],
      },
      { status: 500 }
    );
  }
}

/**
 * Parse markdown content from syllabus to extract subject information
 * Optimized for HTML table structures from KOSEN official syllabus sites
 */
function parseMarkdownToSubjects(
  markdown: string,
  semester: 'spring' | 'fall',
  academicYear: number
) {
  const subjects = [];
  const lines = markdown.split('\n').filter(line => line.trim());

  // Strategy 1: Parse table-like structures (| separator)
  const tableSubjects = parseTableStructure(markdown, semester, academicYear);
  if (tableSubjects.length > 0) {
    return tableSubjects;
  }

  // Strategy 2: Parse header-based structure
  const subjectHeaderPattern = /^#+\s+(.+?)$/;
  let currentSubject: any = null;

  for (const line of lines) {
    const headerMatch = line.match(subjectHeaderPattern);

    if (headerMatch) {
      // Save previous subject if exists
      if (currentSubject && currentSubject.name) {
        subjects.push(createSubjectObject(currentSubject, semester, academicYear));
      }

      // Start new subject
      currentSubject = {
        name: headerMatch[1].trim(),
        instructor: '',
        classType: 'lecture',
        credits: 2,
        evaluationCriteria: [],
      };
    } else if (currentSubject) {
      // Extract metadata from current subject section
      const instructorMatch = line.match(/(?:担当教員|教員|講師|instructor)[:：]\s*(.+)/i);
      if (instructorMatch) {
        currentSubject.instructor = instructorMatch[1].trim();
      }

      const classTypeMatch = line.match(/(?:授業種別|class type)[:：]\s*(.+)/i);
      if (classTypeMatch) {
        currentSubject.classType = parseClassType(classTypeMatch[1]);
      }

      const creditsMatch = line.match(/(?:単位数|credits?)[:：]\s*(\d+)/i);
      if (creditsMatch) {
        currentSubject.credits = parseInt(creditsMatch[1]);
      }
    }
  }

  // Add last subject
  if (currentSubject && currentSubject.name) {
    subjects.push(createSubjectObject(currentSubject, semester, academicYear));
  }

  return subjects;
}

/**
 * Parse table-formatted content (pipe-separated columns)
 */
function parseTableStructure(
  markdown: string,
  semester: 'spring' | 'fall',
  academicYear: number
) {
  const subjects = [];
  const tablePattern = /\|(.+?)\|/g;
  const lines = markdown.split('\n');

  let inTable = false;
  let headerRow: string[] = [];

  for (const line of lines) {
    // Skip separator rows and empty lines
    if (line.match(/^\s*\|?\s*-+\s*\|/) || !line.includes('|')) {
      continue;
    }

    if (line.includes('|')) {
      inTable = true;
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);

      if (cells.length === 0) continue;

      // Detect if this is a header row (contains keywords)
      const isHeaderRow = cells.some(cell =>
        /科目|subject|course|授業|class/i.test(cell)
      );

      if (isHeaderRow) {
        headerRow = cells;
        continue;
      }

      // Parse subject from table row
      if (cells.length >= 2) {
        const subject = {
          name: cells[0] || 'Unknown',
          instructor: cells[1] || '未入力',
          classType: cells[2] ? parseClassType(cells[2]) : 'lecture',
          credits: cells[3] ? parseInt(cells[3]) || 2 : 2,
        };

        // Only add if name looks valid
        if (subject.name.length > 1 && subject.name.length < 100) {
          subjects.push(createSubjectObject(subject, semester, academicYear));
        }
      }
    }
  }

  return subjects;
}

/**
 * Normalize and parse class type from various formats
 */
function parseClassType(typeStr: string) {
  const lower = typeStr.toLowerCase();
  if (lower.includes('実験') || lower.includes('experiment')) {
    return 'experiment';
  }
  if (lower.includes('実習') || lower.includes('practicum') || lower.includes('practice')) {
    return 'practical';
  }
  return 'lecture';
}

/**
 * Create a complete Subject object from parsed data
 */
function createSubjectObject(
  data: any,
  semester: 'spring' | 'fall',
  academicYear: number
) {
  const classType = data.classType || 'lecture';
  const credits = data.credits || 2;
  const classesPerSemester = credits * 15;
  
  // Adjust absence threshold based on class type
  const absenceThreshold = classType === 'experiment' 
    ? Math.ceil(classesPerSemester / 10)
    : Math.floor(classesPerSemester / 3);

  return {
    id: `subject-${Date.now()}-${Math.random()}`,
    name: data.name || 'Unknown Subject',
    instructor: data.instructor || '未入力',
    courseType: 'required',
    classType,
    credits,
    passingGrade: 60,
    evaluationCriteria: data.evaluationCriteria || [
      { id: '1', name: '試験', weight: 70, maxPoints: 100 },
      { id: '2', name: '課題', weight: 20, maxPoints: 100 },
      { id: '3', name: '出席', weight: 10, maxPoints: 100 },
    ],
    grades: [],
    absences: 0,
    absenceRecords: [],
    absenceThreshold,
    classesPerSemester,
    semester,
    academicYear,
  };
}
