import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Upload, Scan, CheckCircle, XCircle, AlertTriangle, Save, 
  RefreshCw, UserCheck, Eye, ListChecks, Edit3, Settings, Check, RotateCcw, FileCheck,
  Bookmark, Trash2, ClipboardList, Copy, Sparkles, FileText, X
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  subject_code?: string;
}

interface Student {
  student_id: string;
  name: string;
  class_group: string;
}

interface AnswerSheetScannerProps {
  exams: Exam[];
  students: Student[];
  onSaveResult?: (result: any) => void;
}

export const AnswerSheetScanner: React.FC<AnswerSheetScannerProps> = ({ exams, students, onSaveResult }) => {
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [scanMode, setScanMode] = useState<'upload' | 'camera'>('upload');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string>('');

  // Choice Format State (ABCD / กขคง / 1234)
  const [choiceFormat, setChoiceFormat] = useState<'latin' | 'thai' | 'numeric'>('latin');

  const choiceOptionsMap: Record<string, string[]> = {
    latin: ['A', 'B', 'C', 'D', 'E'],
    thai: ['ก', 'ข', 'ค', 'ง', 'จ'],
    numeric: ['1', '2', '3', '4', '5']
  };

  const getChoiceDisplay = (choiceVal: string, format: 'latin' | 'thai' | 'numeric' = choiceFormat) => {
    if (!choiceVal) return '';
    if (choiceVal === 'MULTIPLE') return 'MULTIPLE (ฝนซ้ำ)';
    const latinArr = choiceOptionsMap.latin;
    const targetArr = choiceOptionsMap[format] || latinArr;
    const idx = latinArr.indexOf(String(choiceVal).toUpperCase());
    if (idx !== -1 && targetArr[idx]) return targetArr[idx];
    return choiceVal;
  };

  // Live Camera Auto Scanning State
  const [autoScanActive, setAutoScanActive] = useState<boolean>(true);
  const [autoScanInterval, setAutoScanInterval] = useState<number>(3000);
  const [lastAutoScanMsg, setLastAutoScanMsg] = useState<string>('');
  const isScanningRef = useRef<boolean>(false);
  isScanningRef.current = isScanning;

  // Single Scan Result
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [selectedStudentOverride, setSelectedStudentOverride] = useState<string>('');

  // Camera handling
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Batch Scanning
  const [batchResults, setBatchResults] = useState<any[]>([]);

  // Answer Key State (เฉลยคำตอบมาตรฐาน)
  const [numKeyQuestions, setNumKeyQuestions] = useState<number>(30);
  const [answerKey, setAnswerKey] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    const choices = ['A', 'B', 'C', 'D'];
    for (let i = 1; i <= 30; i++) {
      initial[i] = choices[(i - 1) % 4];
    }
    return initial;
  });
  const [showOverlayKey, setShowOverlayKey] = useState<boolean>(true);
  const [showKeyEditor, setShowKeyEditor] = useState<boolean>(true);

  // Subject Answer Key Persistence State
  const [savedKeyTemplates, setSavedKeyTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [saveTemplateName, setSaveTemplateName] = useState<string>('');
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);
  const [keySaveMsg, setKeySaveMsg] = useState<string>('');

  // Copy-Paste Answer Key Importer State
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pasteRawText, setPasteRawText] = useState<string>('');
  const [parsedPreviewMap, setParsedPreviewMap] = useState<Record<number, string>>({});
  const [pastedChoiceFormat, setPastedChoiceFormat] = useState<'latin' | 'thai' | 'numeric'>('thai');

  const parsePastedText = (rawText: string): { map: Record<number, string>; detectedFormat: 'latin' | 'thai' | 'numeric' } => {
    if (!rawText.trim()) return { map: {}, detectedFormat: 'thai' };

    let thaiCount = 0;
    let numericCount = 0;
    let latinCount = 0;

    const mapChoiceToLatin = (str: string): string => {
      if (!str) return '';
      const s = str.trim().toUpperCase();
      if (['ก', 'ข', 'ค', 'ง', 'จ'].includes(s)) {
        thaiCount++;
        if (s === 'ก') return 'A';
        if (s === 'ข') return 'B';
        if (s === 'ค') return 'C';
        if (s === 'ง') return 'D';
        if (s === 'จ') return 'E';
      }
      if (['1', '2', '3', '4', '5'].includes(s)) {
        numericCount++;
        if (s === '1') return 'A';
        if (s === '2') return 'B';
        if (s === '3') return 'C';
        if (s === '4') return 'D';
        if (s === '5') return 'E';
      }
      if (['A', 'B', 'C', 'D', 'E'].includes(s)) {
        latinCount++;
        return s;
      }
      return '';
    };

    const getDetectedFormat = (): 'latin' | 'thai' | 'numeric' => {
      if (thaiCount >= latinCount && thaiCount >= numericCount && thaiCount > 0) return 'thai';
      if (numericCount > latinCount && numericCount > thaiCount && numericCount > 0) return 'numeric';
      if (latinCount > 0) return 'latin';
      return 'thai'; // default to Thai for TH users
    };

    const result: Record<number, string> = {};

    // Strategy 1: Multi-line analysis tracking active question number + "เฉลย:" or "ตอบ:" lines
    const lines = rawText.split(/\r?\n/);
    let currentQ = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if line starts with question number: e.g., "1. ชมพูทวีปคือ...", "ข้อ 2. ...", "1) ..."
      const qMatch = trimmed.match(/^(?:ข้อ\s*)?(\d+)\s*[\.\:\)\-]/i);
      if (qMatch) {
        const foundQ = parseInt(qMatch[1], 10);
        if (foundQ > 0 && foundQ <= 100) {
          currentQ = foundQ;
        }
      }

      // Check if line contains explicit solution prefix: e.g., "เฉลย:ง.อินเดียและเนปาล", "ตอบ: ก", "เฉลย ข้อ 1 ตอบ ง"
      const solMatch = trimmed.match(/(?:เฉลย|ตอบ|Ans(?:wer)?)\s*[:\=]?\s*(?:ข้อ\s*)?(\d+)?\s*[\.\:\)\-\=]?\s*([A-Ea-eก-จ1-5])(?!\d)/i);
      if (solMatch) {
        const explicitQ = solMatch[1] ? parseInt(solMatch[1], 10) : currentQ;
        const rawAns = solMatch[2];
        const latinAns = mapChoiceToLatin(rawAns);
        if (explicitQ > 0 && explicitQ <= 100 && latinAns) {
          result[explicitQ] = latinAns;
          continue;
        }
      }
    }

    if (Object.keys(result).length > 0) {
      return { map: result, detectedFormat: getDetectedFormat() };
    }

    // Strategy 2: Regex matching explicit numbered items in whole text
    // Examples: "ข้อ 1. A", "1) ก", "1.1 B", "Q1: 3", "1 = ข", "ข้อ 1 ตอบ ง", "1.เฉลย ค"
    const numberedRegex = /(?:ข้อ|Q|No\.?)?\s*(\d+)\s*[\.\:\)\-\=\_]*\s*(?:ตอบ|เฉลย|Ans\.?)?\s*[:\=]?\s*([A-Ea-eก-จ1-5])(?!\d)/gi;

    let match;
    let count = 0;
    while ((match = numberedRegex.exec(rawText)) !== null) {
      const qNum = parseInt(match[1], 10);
      const rawAns = match[2];
      const latinAns = mapChoiceToLatin(rawAns);
      if (qNum > 0 && qNum <= 100 && latinAns) {
        result[qNum] = latinAns;
        count++;
      }
    }

    if (count > 0) {
      return { map: result, detectedFormat: getDetectedFormat() };
    }

    // Strategy 3: Fallback - Parse whitespace/comma/newline separated list of choices
    const tokens = rawText.split(/[\s\,\;\t\n]+/).filter(Boolean);
    let qCounter = 1;
    for (const token of tokens) {
      const cleanToken = token.replace(/^(?:ข้อ|Q)?\d+[\.\:\)\-]?/i, '').trim();
      const latinAns = mapChoiceToLatin(cleanToken || token);
      if (latinAns && qCounter <= 100) {
        result[qCounter] = latinAns;
        qCounter++;
      }
    }

    return { map: result, detectedFormat: getDetectedFormat() };
  };

  const handlePasteTextChange = (text: string) => {
    setPasteRawText(text);
    const { map, detectedFormat } = parsePastedText(text);
    setParsedPreviewMap(map);
    setPastedChoiceFormat(detectedFormat);
  };

  const handleApplyPastedKey = () => {
    const keys = Object.keys(parsedPreviewMap).map(Number);
    if (keys.length === 0) {
      alert('ไม่พบข้อมูลเฉลยคำตอบจากข้อความที่วาง กรุณาตรวจสอบรูปแบบข้อความ');
      return;
    }

    const maxQ = Math.max(...keys, 10);
    const roundedNum = maxQ > 60 ? 100 : maxQ > 50 ? 60 : maxQ > 40 ? 50 : maxQ > 30 ? 40 : maxQ > 20 ? 30 : maxQ > 10 ? 20 : 10;
    setNumKeyQuestions(roundedNum);

    // Update main choice format to match detected format
    setChoiceFormat(pastedChoiceFormat);

    setAnswerKey(prev => ({
      ...prev,
      ...parsedPreviewMap
    }));

    setKeySaveMsg(`ดึงและนำเข้าเฉลยคำตอบสำเร็จ ${keys.length} ข้อ! (รูปแบบตัวเลือก: ${pastedChoiceFormat === 'thai' ? 'ก-ข-ค-ง' : pastedChoiceFormat === 'numeric' ? '1-2-3-4' : 'A-B-C-D'})`);
    setShowPasteModal(false);
    setPasteRawText('');
    setParsedPreviewMap({});
    setTimeout(() => setKeySaveMsg(''), 4000);
  };

  // File Upload Key Handler
  const handleKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handlePasteTextChange(text);
      }
    };
    reader.readAsText(file);
  };

  // Fetch saved answer key templates
  const loadSavedTemplates = () => {
    fetch('/api/answer-keys')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSavedKeyTemplates(data);
        }
      })
      .catch(err => console.error('Error loading saved templates:', err));
  };

  useEffect(() => {
    loadSavedTemplates();
  }, []);

  // Load Exam Questions when selectedExamId changes
  useEffect(() => {
    if (!selectedExamId) return;
    const targetExam = exams.find(e => e.id === selectedExamId);
    if (targetExam) {
      setSaveTemplateName(targetExam.title);
    }
    fetch(`/api/exams/${selectedExamId}/questions`)
      .then(r => r.json())
      .then((qList: any[]) => {
        if (Array.isArray(qList) && qList.length > 0) {
          setNumKeyQuestions(qList.length);
          const newKey: Record<number, string> = {};
          const choices = ['A', 'B', 'C', 'D', 'E'];
          qList.forEach((q, idx) => {
            const qNum = idx + 1;
            let correct = '';
            if (q.correct_answer) correct = q.correct_answer;
            else if (q.answer) correct = q.answer;
            else if (typeof q.correct_index === 'number' && q.correct_index >= 0) {
              correct = choices[q.correct_index] || 'A';
            }
            newKey[qNum] = correct || choices[idx % 4];
          });
          setAnswerKey(newKey);
        }
      })
      .catch(err => console.error('Error loading exam questions:', err));
  }, [selectedExamId, exams]);

  // Apply a selected template
  const handleApplyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const found = savedKeyTemplates.find(t => t.id === templateId);
    if (found && found.key_data) {
      setNumKeyQuestions(found.num_questions || Object.keys(found.key_data).length);
      setAnswerKey(found.key_data);
      setSaveTemplateName(found.title);
      setKeySaveMsg(`โหลดชุดเฉลย "${found.title}" เรียบร้อยแล้ว`);
      setTimeout(() => setKeySaveMsg(''), 3000);
    }
  };

  // Save current answer key as subject template / exam key
  const handleSaveAnswerKey = async () => {
    const titleToSave = saveTemplateName.trim() || (selectedExamId ? exams.find(e => e.id === selectedExamId)?.title : '') || 'ชุดเฉลยรายวิชา';
    if (!titleToSave) {
      alert('กรุณากรอกชื่อรายวิชาหรือชื่อชุดเฉลยก่อนบันทึก');
      return;
    }

    setIsSavingKey(true);
    setKeySaveMsg('');

    try {
      // 1. Save to /api/answer-keys template list
      const res = await fetch('/api/answer-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTemplateId || undefined,
          title: titleToSave,
          subject_code: selectedExamId ? (exams.find(e => e.id === selectedExamId)?.subject_code || '') : '',
          num_questions: numKeyQuestions,
          key_data: answerKey
        })
      });
      const data = await res.json();

      // 2. If an exam is selected, also save to questions table for that exam
      if (selectedExamId) {
        const choicesMap = ['A', 'B', 'C', 'D', 'E'];
        const questionsList = Array.from({ length: numKeyQuestions }).map((_, idx) => {
          const qNum = idx + 1;
          const ans = answerKey[qNum] || 'A';
          const cIndex = choicesMap.indexOf(ans) !== -1 ? choicesMap.indexOf(ans) : 0;
          return {
            question_text: `ข้อที่ ${qNum}`,
            options: ['ก', 'ข', 'ค', 'ง'],
            correct_index: cIndex,
            correct_answer: ans,
            points: 1
          };
        });

        await fetch(`/api/exams/${selectedExamId}/questions/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: questionsList })
        });
      }

      if (data.success) {
        setKeySaveMsg(`บันทึกชุดเฉลยรายวิชา "${titleToSave}" สำเร็จ!`);
        loadSavedTemplates();
        if (data.answerKeyTemplate) {
          setSelectedTemplateId(data.answerKeyTemplate.id);
        }
        setTimeout(() => setKeySaveMsg(''), 4000);
      }
    } catch (err: any) {
      console.error('Save answer key failed:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกเฉลย: ' + (err.message || err));
    } finally {
      setIsSavingKey(false);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (templateId: string, title: string) => {
    if (!confirm(`ต้องการลบชุดเฉลย "${title}" ใช่หรือไม่?`)) return;
    try {
      await fetch(`/api/answer-keys/${templateId}`, { method: 'DELETE' });
      if (selectedTemplateId === templateId) setSelectedTemplateId('');
      loadSavedTemplates();
      setKeySaveMsg(`ลบชุดเฉลย "${title}" เรียบร้อยแล้ว`);
      setTimeout(() => setKeySaveMsg(''), 3000);
    } catch (err) {
      console.error('Delete template failed:', err);
    }
  };

  // Handle Editing Answer Key Choice
  const handleKeyChoiceChange = (qNum: number, choice: string) => {
    setAnswerKey(prev => ({
      ...prev,
      [qNum]: choice
    }));
  };

  // Pattern Fill Helper
  const handlePatternFill = (pattern: 'ABCD' | 'A' | 'B' | 'C' | 'D' | 'CLEAR') => {
    const newKey: Record<number, string> = {};
    const choices = ['A', 'B', 'C', 'D'];
    for (let i = 1; i <= numKeyQuestions; i++) {
      if (pattern === 'ABCD') newKey[i] = choices[(i - 1) % 4];
      else if (pattern === 'CLEAR') newKey[i] = '';
      else newKey[i] = pattern;
    }
    setAnswerKey(newKey);
  };

  // Change Total Number of Key Items
  const handleNumQuestionsChange = (count: number) => {
    setNumKeyQuestions(count);
    const choices = ['A', 'B', 'C', 'D'];
    setAnswerKey(prev => {
      const updated = { ...prev };
      for (let i = 1; i <= count; i++) {
        if (!updated[i]) updated[i] = choices[(i - 1) % 4];
      }
      return updated;
    });
  };

  // Start Camera
  const startCamera = async () => {
    try {
      setCameraActive(true);
      setScanError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      let errMsg = 'ไม่สามารถเข้าถึงกล้องได้ โปรดอนุญาตสิทธิ์ใช้งานกล้องในเบราว์เซอร์';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || String(err?.message).toLowerCase().includes('permission denied')) {
        errMsg = 'เบราว์เซอร์ปฏิเสธการเข้าถึงกล้อง (Permission denied) โปรดคลิกอนุญาตสิทธิ์ใช้งานกล้องบนแถบที่อยู่เว็บ (Address Bar) หรือเปิดในหน้าต่างใหม่';
      }
      setScanError(errMsg);
      setCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Auto Scan timer effect for live camera
  useEffect(() => {
    let timer: any = null;
    if (scanMode === 'camera' && cameraActive && autoScanActive) {
      timer = setInterval(() => {
        if (videoRef.current && !isScanningRef.current) {
          captureAutoPhoto();
        }
      }, autoScanInterval);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [scanMode, cameraActive, autoScanActive, autoScanInterval]);

  // Capture auto photo without stopping camera
  const captureAutoPhoto = () => {
    if (!videoRef.current || isScanningRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPreviewImage(dataUrl);
      processOcrImage(dataUrl, true);
    }
  };

  // Capture image from camera manually
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setPreviewImage(dataUrl);
      stopCamera();
      processOcrImage(dataUrl, false);
    }
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPreviewImage(base64);
        processOcrImage(base64);
      };
      reader.readAsDataURL(file);
    } else {
      processBatchFiles(Array.from(files));
    }
  };

  // Process Batch Files
  const processBatchFiles = async (fileList: File[]) => {
    setIsScanning(true);
    setScanError('');
    const newResults: any[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const base64 = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(file);
      });

      try {
        const res = await fetch('/api/ocr/grade-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            examId: selectedExamId,
            customAnswerKey: answerKey,
            numQuestions: numKeyQuestions,
            students
          })
        });
        const data = await res.json();
        if (data.success) {
          newResults.push({ ...data, imageBase64: base64, fileIndex: i + 1, fileName: file.name });
        }
      } catch (err) {
        console.error('Batch scan file error:', err);
      }
    }

    setBatchResults(newResults);
    setIsScanning(false);
  };

  // Process Single OCR Image
  const processOcrImage = async (base64Img?: string, isAutoScan: boolean = false) => {
    const imageToProcess = base64Img || previewImage;
    if (!imageToProcess) return;

    setIsScanning(true);
    setScanError('');
    setScanResult(null);
    setIsSaved(false);

    try {
      const res = await fetch('/api/ocr/grade-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageToProcess,
          examId: selectedExamId,
          customAnswerKey: answerKey,
          numQuestions: numKeyQuestions,
          students
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'การตรวจรูปภาพล้มเหลว');
      }

      setScanResult(data);
      if (data.matchedStudent) {
        setSelectedStudentOverride(data.matchedStudent.student_id);
      } else if (data.detectedStudentId) {
        setSelectedStudentOverride(data.detectedStudentId);
      }

      if (isAutoScan) {
        setLastAutoScanMsg(`✓ สแกนอัตโนมัติสำเร็จ! คะแนน: ${data.score}/${data.maxScore} (${data.percentage}%)`);
        setTimeout(() => setLastAutoScanMsg(''), 4000);
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      if (!isAutoScan) {
        setScanError(err.message || 'เกิดข้อผิดพลาดในการสแกนรูปภาพ');
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Save Graded Result to Database
  const handleSaveResult = async (resultToSave: any) => {
    const sId = selectedStudentOverride || resultToSave.detectedStudentId || 'STD_UNKNOWN';
    const foundStu = students.find(s => String(s.student_id) === String(sId));
    const sName = foundStu ? foundStu.name : (resultToSave.detectedStudentName || 'นักเรียน (สแกน OMR)');

    const payload = {
      student_id: sId,
      student_name: sName,
      exam_id: selectedExamId || resultToSave.examId || 'EX-OMR-STD',
      score: resultToSave.score,
      total_score: resultToSave.maxScore,
      answers: resultToSave.itemAnalysis.reduce((acc: any, cur: any) => {
        acc[cur.questionNum] = cur.markedChoice;
        return acc;
      }, {}),
      status: 'completed'
    };

    try {
      const res = await fetch('/api/exam-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsSaved(true);
        if (onSaveResult) onSaveResult(payload);
      }
    } catch (err) {
      console.error('Save result failed:', err);
    }
  };

  // Save All Batch Results
  const handleSaveAllBatch = async () => {
    for (const bRes of batchResults) {
      await handleSaveResult(bRes);
    }
    alert('บันทึกผลการตรวจทั้งหมดเข้าสู่ระบบเรียบร้อยแล้ว!');
  };

  // Handle Changing Marked Choice or Correct Answer in Result Table
  const handleResultItemChange = (questionNum: number, field: 'markedChoice' | 'correctAnswer', value: string) => {
    if (!scanResult || !scanResult.itemAnalysis) return;

    const updatedAnalysis = scanResult.itemAnalysis.map((item: any) => {
      if (item.questionNum === questionNum) {
        const updatedItem = { ...item, [field]: value };
        const isCorrect = updatedItem.markedChoice !== '' && 
                          updatedItem.markedChoice !== 'MULTIPLE' && 
                          updatedItem.markedChoice === updatedItem.correctAnswer;
        return { ...updatedItem, isCorrect };
      }
      return item;
    });

    const newScore = updatedAnalysis.filter((i: any) => i.isCorrect).length;
    const maxScore = updatedAnalysis.length;
    const percentage = maxScore > 0 ? Math.round((newScore / maxScore) * 1000) / 10 : 0;

    setScanResult({
      ...scanResult,
      score: newScore,
      maxScore,
      percentage,
      itemAnalysis: updatedAnalysis
    });

    // Also update current answerKey state if answer key changed
    if (field === 'correctAnswer') {
      setAnswerKey(prev => ({ ...prev, [questionNum]: value }));
    }
  };

  // Columns helper for Answer Key Overlay Grid
  const getAnswerKeyColumns = () => {
    const cols = 3;
    const itemsPerCol = Math.ceil(numKeyQuestions / cols);
    const columnsArr: number[][] = [];
    for (let c = 0; c < cols; c++) {
      const colItems: number[] = [];
      for (let i = 0; i < itemsPerCol; i++) {
        const qNum = c * itemsPerCol + i + 1;
        if (qNum <= numKeyQuestions) colItems.push(qNum);
      }
      if (colItems.length > 0) columnsArr.push(colItems);
    }
    return columnsArr;
  };

  return (
    <div className="space-y-6">
      {/* HEADER & SELECT EXAM */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Scan className="w-6 h-6 text-cyan-400" />
              ระบบตรวจกระดาษคำตอบ OMR (OMR Answer Sheet Auto-Grader)
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              ถ่ายภาพหรืออัปโหลดรูปกระดาษคำตอบ OMR แสดงเฉลยบนภาพ ตรวจความถูกต้อง และบันทึกคะแนนอัตโนมัติ
            </p>
          </div>

          {/* SCAN MODE TOGGLE */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => { stopCamera(); setScanMode('upload'); }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${scanMode === 'upload' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Upload className="w-4 h-4" />
              อัปโหลดไฟล์ / รูปภาพ
            </button>
            <button
              onClick={() => { setScanMode('camera'); startCamera(); }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${scanMode === 'camera' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Camera className="w-4 h-4" />
              ถ่ายภาพจากกล้องสด
            </button>
          </div>
        </div>

        {/* EXAM SELECTOR & OVERLAY TOGGLE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 items-center">
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              เลือกชุดข้อสอบดึงเฉลยอัตโนมัติ
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">-- ไม่ระบุ (กำหนด/แก้ไขเฉลยเองด้านล่าง) --</option>
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.subject_code ? `[${ex.subject_code}] ` : ''}{ex.title}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1 flex flex-col justify-center">
            <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2">
              หรือ นำเข้าเฉลยคำตอบด่วน
            </label>
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-300/40"
            >
              <ClipboardList className="w-4 h-4" />
              📥 นำเข้าเฉลยคำตอบ (คัดลอกวาง / อัปโหลดไฟล์)
            </button>
          </div>

          <div className="md:col-span-1 flex flex-col justify-center space-y-2 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                โหมดแสดงเฉลยข้อถูกบนภาพกระดาษคำตอบ
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOverlayKey}
                  onChange={(e) => setShowOverlayKey(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            <p className="text-[11px] text-slate-400">
              เมื่อเปิดสวิตช์ ระบบจะแสดงเฉลยข้อถูกกำกับเคียงคู่/ซ้อนบนภาพกระดาษคำตอบ และสามารถแก้ไขเฉลยได้ทันที
            </p>
          </div>
        </div>
      </div>

      {/* ANSWER KEY EDITOR PANEL (แผงจัดการและแก้ไขเฉลยข้อสอบก่อนตรวจ) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              กำหนดและแก้ไขเฉลยคำตอบมาตรฐาน ({numKeyQuestions} ข้อ)
            </h3>
            <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
              สามารถแก้ไขเฉลยได้ตลอดเวลา
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* CHOICE FORMAT SWITCHER */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-700/80 rounded-lg p-1 text-xs mr-1">
              <span className="text-[11px] font-semibold text-slate-400 pl-1">ตัวเลือกเฉลย:</span>
              <button
                type="button"
                onClick={() => setChoiceFormat('latin')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${choiceFormat === 'latin' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                A-B-C-D
              </button>
              <button
                type="button"
                onClick={() => setChoiceFormat('thai')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${choiceFormat === 'thai' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                ก-ข-ค-ง
              </button>
              <button
                type="button"
                onClick={() => setChoiceFormat('numeric')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${choiceFormat === 'numeric' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                1-2-3-4
              </button>
            </div>

            <span className="text-slate-400">จำนวนข้อ:</span>
            <select
              value={numKeyQuestions}
              onChange={(e) => handleNumQuestionsChange(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-semibold"
            >
              <option value={10}>10 ข้อ</option>
              <option value={20}>20 ข้อ</option>
              <option value={30}>30 ข้อ</option>
              <option value={40}>40 ข้อ</option>
              <option value={50}>50 ข้อ</option>
              <option value={60}>60 ข้อ</option>
              <option value={100}>100 ข้อ</option>
            </select>

            <button
              onClick={() => handlePatternFill('ABCD')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-[11px] font-semibold cursor-pointer"
            >
              เติมสลับ 4 ตัวเลือก
            </button>
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold rounded-lg text-[11px] cursor-pointer shadow flex items-center gap-1.5 transition-all"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              ดึงเฉลยจากการคัดลอกวาง
            </button>
            <button
              onClick={() => handlePatternFill('CLEAR')}
              className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 rounded-lg border border-rose-800/40 text-[11px] font-semibold cursor-pointer"
            >
              เคลียร์เฉลย
            </button>

            <button
              onClick={() => setShowKeyEditor(!showKeyEditor)}
              className="px-3 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800/60 rounded-lg font-bold text-[11px] cursor-pointer"
            >
              {showKeyEditor ? 'ซ่อนแผงตารางเฉลย' : 'แสดงแผงตารางเฉลย'}
            </button>
          </div>
        </div>

        {/* SUBJECT ANSWER KEY MANAGEMENT BAR (บันทึก/เลือกเฉลยรายวิชา) */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Bookmark className="w-4 h-4 text-amber-400" />
              ระบบจัดการบันทึกเฉลยคำตอบเป็นรายวิชา (Subject Answer Key Template)
            </span>
            {keySaveMsg && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/90 border border-emerald-800 px-3 py-1 rounded-full animate-pulse">
                ✓ {keySaveMsg}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            {/* SELECT SAVED SUBJECT TEMPLATE */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                ดึงชุดเฉลยที่เคยบันทึกไว้ ({savedKeyTemplates.length} รายวิชา)
              </label>
              <div className="flex gap-1.5">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- ดึงเฉลยจากวิชาที่เคยบันทึกไว้ --</option>
                  {savedKeyTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.num_questions} ข้อ)
                    </option>
                  ))}
                </select>
                {selectedTemplateId && (
                  <button
                    onClick={() => {
                      const sel = savedKeyTemplates.find(t => t.id === selectedTemplateId);
                      if (sel) handleDeleteTemplate(sel.id, sel.title);
                    }}
                    title="ลบชุดเฉลยนี้"
                    className="p-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-lg text-xs cursor-pointer flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* SAVE TEMPLATE NAME INPUT */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                ชื่อรายวิชา / ชื่อชุดเฉลยเพื่อบันทึก
              </label>
              <input
                type="text"
                placeholder="เช่น วิชาฟิสิกส์ ม.5 (กลางภาค)"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* SAVE BUTTON */}
            <div>
              <button
                onClick={handleSaveAnswerKey}
                disabled={isSavingKey}
                className="w-full py-1.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-lg shadow transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSavingKey ? 'กำลังบันทึก...' : 'บันทึกเฉลยลงรายวิชานี้'}
              </button>
            </div>
          </div>
        </div>

        {showKeyEditor && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto p-1 pr-2">
            {Array.from({ length: numKeyQuestions }).map((_, idx) => {
              const qNum = idx + 1;
              const currentChoice = answerKey[qNum] || '';
              return (
                <div key={qNum} className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-2 text-center space-y-1">
                  <div className="text-[11px] font-bold text-slate-300 flex justify-between items-center">
                    <span>ข้อ {qNum}</span>
                    <span className="text-emerald-400 font-mono font-extrabold">{getChoiceDisplay(currentChoice) || '-'}</span>
                  </div>
                  <div className="flex justify-center gap-1">
                    {['A', 'B', 'C', 'D', 'E'].map((c, cIdx) => {
                      const displayLabel = choiceOptionsMap[choiceFormat]?.[cIdx] || c;
                      return (
                        <button
                          key={c}
                          onClick={() => handleKeyChoiceChange(qNum, c)}
                          className={`w-5 h-5 rounded text-[10px] font-bold transition-all cursor-pointer ${currentChoice === c ? 'bg-emerald-500 text-white shadow ring-1 ring-emerald-300' : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                        >
                          {displayLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ERROR ALERT */}
      {scanError && (
        <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 p-4 rounded-xl text-sm space-y-3 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">{scanError}</span>
              <p className="text-xs text-rose-300/80 mt-1">
                คำแนะนำ: หากใช้งานผ่าน iFrame ของเบราว์เซอร์ การอนุญาตสิทธิ์กล้องอาจถูกบล็อกโดยความปลอดภัยของเบราว์เซอร์ คุณสามารถสลับไปใช้อัปโหลดไฟล์รูปภาพกระดาษคำตอบ หรือเปิดแอปในหน้าต่างใหม่ (New Tab) เพื่อเปิดใช้งานกล้องสดได้ทันที
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1 border-t border-rose-800/60 text-xs">
            <button
              type="button"
              onClick={startCamera}
              className="px-3 py-1.5 bg-rose-900 hover:bg-rose-800 text-rose-100 font-bold rounded-lg border border-rose-700 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <Camera className="w-3.5 h-3.5" />
              ลองเปิดกล้องใหม่อีกครั้ง
            </button>
            <button
              type="button"
              onClick={() => {
                setScanMode('upload');
                setScanError('');
              }}
              className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 font-bold rounded-lg border border-cyan-800 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              สลับไปใช้อัปโหลดไฟล์ภาพกระดาษคำตอบแทน
            </button>
            <button
              type="button"
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 cursor-pointer flex items-center gap-1.5 transition-all ml-auto"
            >
              <Eye className="w-3.5 h-3.5" />
              เปิดแอปในแท็บใหม่ (New Tab)
            </button>
          </div>
        </div>
      )}

      {/* SCANNING INPUT AREA */}
      {scanMode === 'upload' ? (
        <div className="bg-slate-900/60 border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-2xl p-8 text-center transition-all cursor-pointer relative group">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-all">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-bold text-white">ลากรูปภาพกระดาษคำตอบมาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์</p>
              <p className="text-xs text-slate-400 mt-1">
                รองรับไฟล์ภาพ JPG, PNG (สามารถเลือกทีละหลายๆ ภาพเพื่อตรวจแบบ Batch สแกนชุดได้)
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* CAMERA LIVE SCANNER AREA */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          {/* LIVE AUTO SCANNER CONTROLS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3.5 rounded-xl border border-cyan-500/30">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScanActive}
                  onChange={(e) => setAutoScanActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
              <div className="text-left">
                <span className="text-xs font-bold text-cyan-300 block flex items-center gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${autoScanActive ? 'animate-spin text-cyan-400' : 'text-slate-500'}`} />
                  โหมดสแกนและเฉลยอัตโนมัติแบบกล้องสด (Auto-Scan & Grade Stream)
                </span>
                <span className="text-[10px] text-slate-400">
                  เมื่อนำกระดาษคำตอบเข้าหากล้อง ระบบจะตรวจจับและสแกนเฉลยให้อัตโนมัติโดยไม่ต้องกดปุ่ม
                </span>
              </div>
            </div>

            {autoScanActive && (
              <div className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1">
                <span className="text-[10px] font-semibold text-slate-400">ความถี่ในการตรวจ:</span>
                {[2000, 3000, 5000].map((ms) => (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => setAutoScanInterval(ms)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${autoScanInterval === ms ? 'bg-cyan-500 text-slate-950 font-extrabold' : 'text-slate-400 hover:text-white'}`}
                  >
                    {ms / 1000} วินาที
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative max-w-2xl mx-auto rounded-xl overflow-hidden border-2 border-cyan-500/50 bg-black aspect-[4/3] flex items-center justify-center shadow-2xl">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            
            {/* OVERLAY FRAME GUIDE */}
            <div className="absolute inset-8 border-2 border-dashed border-cyan-400/70 rounded-lg pointer-events-none flex items-center justify-center">
              <span className="bg-black/70 text-cyan-300 text-xs px-3 py-1.5 rounded-full font-semibold border border-cyan-500/30">
                วางกระดาษคำตอบให้อยู่ภายในกรอบสี่เหลี่ยมนี้
              </span>
            </div>

            {/* SCANNING LASER ANIMATION WHEN AUTO SCAN IS RUNNING */}
            {autoScanActive && cameraActive && (
              <div className="absolute inset-x-8 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-pulse pointer-events-none top-1/2 -translate-y-1/2"></div>
            )}

            {/* LIVE AUTO SCAN SUCCESS BADGE NOTIFICATION */}
            {lastAutoScanMsg && (
              <div className="absolute top-4 inset-x-4 bg-emerald-950/90 border border-emerald-500 text-emerald-300 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center justify-center gap-2 animate-bounce">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>{lastAutoScanMsg}</span>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={capturePhoto}
              disabled={!cameraActive || isScanning}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-5 h-5" />
              ถ่ายรูปตรวจเฉลยด้วยตนเอง (Manual Capture)
            </button>

            <button
              onClick={stopCamera}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
            >
              ปิดกล้อง
            </button>
          </div>
        </div>
      )}

      {/* PREVIEW IMAGE & ANSWER KEY OVERLAY (แสดงเฉลยข้อถูกซ้อน/เคียงคู่ภาพกระดาษคำตอบก่อน/หลังตรวจ) */}
      {previewImage && (
        <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">
                ภาพกระดาษคำตอบพร้อมเฉลยคำตอบมาตรฐาน (Answer Key Overlay)
              </h3>
            </div>

            <button
              onClick={() => processOcrImage()}
              disabled={isScanning}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Scan className="w-4 h-4" />
              สแกนและคำนวณคะแนน OMR ใหม่ (Scan & Grade)
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* SHEET IMAGE PREVIEW */}
            <div className="bg-black/80 rounded-xl p-2 border border-slate-800 flex flex-col items-center space-y-2">
              <span className="text-[11px] text-slate-400 font-semibold">ภาพกระดาษคำตอบที่สแกน</span>
              <div className="relative max-h-96 overflow-hidden rounded border border-slate-700">
                <img src={previewImage} alt="Answer sheet preview" className="max-h-96 object-contain" />
              </div>
            </div>

            {/* ANSWER KEY OVERLAY PANEL (แผงเฉลยข้อถูกสำหรับสอบทานและแก้ไขก่อนตรวจ) */}
            {showOverlayKey ? (
              <div className="bg-slate-950 border-2 border-emerald-800/80 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-emerald-900 pb-2">
                  <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    แผงเฉลยข้อถูกที่ใช้วัดผล ({numKeyQuestions} ข้อ)
                  </span>
                  <span className="text-[10px] text-slate-400 italic">
                    *(คลิกวงกลมตัวเลือกเพื่อแก้ไขเฉลยได้ทันที)*
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto p-1">
                  {getAnswerKeyColumns().map((items, colIdx) => (
                    <div key={colIdx} className="bg-slate-900/90 border border-slate-800 rounded p-2 space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-1 mb-1 text-center">
                        ข้อ / เฉลย
                      </div>
                      {items.map(qNum => {
                        const correctC = answerKey[qNum] || '';
                        return (
                          <div key={qNum} className="flex items-center justify-between text-xs py-0.5 px-1 border-b border-slate-800/40">
                            <span className="font-bold text-slate-300 text-[11px] w-6">
                              {qNum}.
                            </span>
                            <div className="flex gap-1">
                              {['A', 'B', 'C', 'D', 'E'].map((c, cIdx) => {
                                const displayLabel = choiceOptionsMap[choiceFormat]?.[cIdx] || c;
                                return (
                                  <button
                                    key={c}
                                    onClick={() => handleKeyChoiceChange(qNum, c)}
                                    className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center transition-all cursor-pointer ${correctC === c ? 'bg-emerald-500 text-white font-extrabold ring-2 ring-emerald-300 scale-110' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                                  >
                                    {displayLabel}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-8 text-center text-slate-400 text-xs">
                ปิดการแสดงเฉลยซ้อนบนภาพแล้ว (สามารถเปิดใหม่ได้จากเมนูด้านบน)
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCANNING LOADING ANIMATION */}
      {isScanning && (
        <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
              <Scan className="w-5 h-5 text-cyan-400 animate-pulse" />
              กำลังประมวลผลอ่านกระดาษคำตอบด้วย OMR...
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              ระบบกำลังวิเคราะห์รหัสนักเรียน ตรวจสอบวงกลมคำตอบ และคำนวณผลสอบ
            </p>
          </div>
        </div>
      )}

      {/* SINGLE SCAN RESULT DISPLAY */}
      {scanResult && !isScanning && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950 border border-cyan-800/50 px-3 py-1 rounded-full">
                ผลการสแกนตรวจคำตอบสำเร็จ
              </span>
              <h3 className="text-xl font-bold text-white mt-2">
                {scanResult.detectedExamTitle || 'กระดาษคำตอบสแกน OMR'}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveResult(scanResult)}
                disabled={isSaved}
                className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-xl shadow-lg transition-all cursor-pointer ${isSaved ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
              >
                {isSaved ? (
                  <>
                    <CheckCircle className="w-5 h-5" /> บันทึกผลสอบแล้ว
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" /> บันทึกผลลงฐานข้อมูล
                  </>
                )}
              </button>
            </div>
          </div>

          {/* OVERVIEW SCORE & STUDENT MATCH CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* SCORE CARD */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 text-center space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">คะแนนเลือกตอบ (OMR)</span>
              <div className="text-3xl font-extrabold text-white">
                <span className="text-emerald-400">{scanResult.score}</span> / {scanResult.maxScore}
              </div>
              <div className="text-xs font-bold text-slate-300">
                คิดเป็น {scanResult.percentage}%
              </div>
            </div>

            {/* TEACHER SCORE BOX DETECTED CARD */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 text-center space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">คะแนนครูตรวจอัตนัย (สแกนได้)</span>
              <div className="text-3xl font-extrabold text-white">
                <span className="text-amber-400">
                  {scanResult.teacherWrittenScore !== null && scanResult.teacherWrittenScore !== undefined 
                    ? scanResult.teacherWrittenScore 
                    : (scanResult.teacherTotalScore !== null && scanResult.teacherTotalScore !== undefined ? scanResult.teacherTotalScore : '-')}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                {scanResult.teacherTotalScore ? `คะแนนรวมสุทธิที่ครูลงไว้: ${scanResult.teacherTotalScore}` : 'คะแนนจากกรอบครูตรวจ'}
              </div>
            </div>

            {/* STUDENT MATCH CARD */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">การระบุตัวตนนักเรียน</span>
              {scanResult.matchedStudent ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{scanResult.matchedStudent.name}</p>
                    <p className="text-xs text-slate-400">รหัส: {scanResult.matchedStudent.student_id} | ชั้น {scanResult.matchedStudent.class_group}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-amber-400 font-semibold">
                    ⚠️ อ่านรหัสได้: {scanResult.detectedStudentId || 'ไม่ชัดเจน'} (ไม่ตรงกับในระบบ)
                  </p>
                  <select
                    value={selectedStudentOverride}
                    onChange={(e) => setSelectedStudentOverride(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  >
                    <option value="">-- เลือกจับคู่กับนักเรียนในรายชื่อ --</option>
                    {students.map(s => (
                      <option key={s.student_id} value={s.student_id}>
                        {s.student_id} - {s.name} ({s.class_group})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* CONFIDENCE & IMAGE PREVIEW */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">ความแม่นยำ OMR</span>
                <span className="text-lg font-bold text-cyan-400">{scanResult.confidenceScore}% Confidence</span>
                {scanResult.notes && (
                  <p className="text-[11px] text-slate-400 mt-1 italic">{scanResult.notes}</p>
                )}
              </div>
              {previewImage && (
                <img src={previewImage} alt="Scanned sheet" className="w-16 h-20 object-cover rounded border border-slate-600 shadow" />
              )}
            </div>
          </div>

          {/* ITEM-BY-ITEM DETAILED & EDITABLE TABLE */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 font-bold text-sm text-white flex justify-between items-center">
              <span>รายการตรวจคำตอบรายข้อ ({scanResult.itemAnalysis?.length || 0} ข้อ) - สามารถปรับเปลี่ยนตัวเลือกหรือเฉลยได้ทันที</span>
              <span className="text-xs text-slate-400">เขียว = ถูกต้อง | แดง = ตอบผิด | ส้ม = ฝนซ้ำ/เว้นว่าง</span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">ข้อที่</th>
                    <th className="px-4 py-3">ตัวเลือกที่สแกนได้ / ระบาย</th>
                    <th className="px-4 py-3">เฉลยที่ถูกต้อง (แก้ไขได้)</th>
                    <th className="px-4 py-3">ผลการตรวจ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {scanResult.itemAnalysis?.map((item: any) => (
                    <tr key={item.questionNum} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 font-bold text-white">ข้อ {item.questionNum}</td>
                      
                      {/* EDITABLE MARKED CHOICE */}
                      <td className="px-4 py-2.5">
                        <select
                          value={item.markedChoice}
                          onChange={(e) => handleResultItemChange(item.questionNum, 'markedChoice', e.target.value)}
                          className={`px-2 py-1 rounded font-mono font-bold text-xs border focus:outline-none cursor-pointer ${item.markedChoice === 'MULTIPLE' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : item.markedChoice === '' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-800 text-white border-slate-700'}`}
                        >
                          <option value="">(เว้นว่าง)</option>
                          <option value="A">{getChoiceDisplay('A')} {choiceFormat !== 'latin' ? '(A)' : ''}</option>
                          <option value="B">{getChoiceDisplay('B')} {choiceFormat !== 'latin' ? '(B)' : ''}</option>
                          <option value="C">{getChoiceDisplay('C')} {choiceFormat !== 'latin' ? '(C)' : ''}</option>
                          <option value="D">{getChoiceDisplay('D')} {choiceFormat !== 'latin' ? '(D)' : ''}</option>
                          <option value="E">{getChoiceDisplay('E')} {choiceFormat !== 'latin' ? '(E)' : ''}</option>
                          <option value="MULTIPLE">MULTIPLE (ฝนซ้ำ)</option>
                        </select>
                      </td>

                      {/* EDITABLE CORRECT ANSWER */}
                      <td className="px-4 py-2.5">
                        <select
                          value={item.correctAnswer}
                          onChange={(e) => handleResultItemChange(item.questionNum, 'correctAnswer', e.target.value)}
                          className="bg-slate-800 text-emerald-400 border border-slate-700 font-mono font-bold px-2 py-1 rounded text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="">-- ไม่ระบุ --</option>
                          <option value="A">{getChoiceDisplay('A')} {choiceFormat !== 'latin' ? '(A)' : ''}</option>
                          <option value="B">{getChoiceDisplay('B')} {choiceFormat !== 'latin' ? '(B)' : ''}</option>
                          <option value="C">{getChoiceDisplay('C')} {choiceFormat !== 'latin' ? '(C)' : ''}</option>
                          <option value="D">{getChoiceDisplay('D')} {choiceFormat !== 'latin' ? '(D)' : ''}</option>
                          <option value="E">{getChoiceDisplay('E')} {choiceFormat !== 'latin' ? '(E)' : ''}</option>
                        </select>
                      </td>

                      {/* VERDICT STATUS */}
                      <td className="px-4 py-2.5">
                        {item.correctAnswer ? (
                          item.isCorrect ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                              <CheckCircle className="w-4 h-4" /> ถูกต้อง (+1)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-rose-400 font-bold">
                              <XCircle className="w-4 h-4" /> ผิด (0)
                            </span>
                          )
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BATCH RESULTS LIST */}
      {batchResults.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-emerald-400" />
              สรุปผลการสแกนแบบชุด (Batch Scanned: {batchResults.length} แผ่น)
            </h3>
            <button
              onClick={handleSaveAllBatch}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> บันทึกคะแนนทั้งหมดเข้าฐานข้อมูล
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800 text-slate-400 font-semibold uppercase border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3">ไฟล์ที่</th>
                  <th className="px-4 py-3">รหัสนักเรียน</th>
                  <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                  <th className="px-4 py-3">คะแนนที่ได้</th>
                  <th className="px-4 py-3">คิดเป็น %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {batchResults.map((res, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-bold text-white">#{res.fileIndex} ({res.fileName})</td>
                    <td className="px-4 py-2.5 font-mono text-cyan-400">{res.detectedStudentId || '-'}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-200">{res.detectedStudentName || 'นักเรียน'}</td>
                    <td className="px-4 py-2.5 font-bold text-emerald-400">{res.score} / {res.maxScore}</td>
                    <td className="px-4 py-2.5 font-bold">{res.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COPY-PASTE ANSWER KEY IMPORTER MODAL */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">ดึงและนำเข้าเฉลยคำตอบจากการคัดลอกวาง (Paste Answer Key Importer)</h3>
                  <p className="text-xs text-slate-400">คัดลอกข้อความเฉลยจากไฟล์เอกสาร Word, PDF หรือข้อความ แล้วนำมาวางได้ทันที</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Guidance Box */}
              <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 text-xs space-y-1.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  รูปแบบข้อความเฉลยที่ระบบรองรับอัตโนมัติ:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800 font-mono">
                    <span className="text-amber-400 font-bold">1. ข้อคำถามพร้อมเฉลยในตัว:</span><br />
                    1. โจทย์คำถาม...<br />
                    ก. ตัวเลือก 1 &nbsp; ข. ตัวเลือก 2<br />
                    ค. ตัวเลือก 3 &nbsp; ง. ตัวเลือก 4<br />
                    <span className="text-emerald-400 font-bold">เฉลย:ง.คำตอบที่ถูก</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800 font-mono">
                    <span className="text-amber-400 font-bold">2. ข้อตามด้วยตัวเลือก/คำว่าตอบ:</span><br />
                    1. A &nbsp; 2. B &nbsp; 3. C &nbsp; 4. D<br />
                    ข้อ 1 ตอบ ก &nbsp; ข้อ 2 ตอบ ข<br />
                    1) 3 &nbsp; 2) 4
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800 font-mono col-span-1 sm:col-span-2">
                    <span className="text-amber-400 font-bold">3. รายการตัวเลือกต่อเนื่อง:</span> A B C D A B C D หรือ ก ข ค ง จ
                  </div>
                </div>
              </div>

              {/* Text Area and File Upload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    วางข้อความเฉลยที่นี่ (Paste Answer Text Here):
                  </label>
                  <label className="cursor-pointer px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    หรือเลือกไฟล์เฉลย (.txt, .csv)
                    <input
                      type="file"
                      accept=".txt,.csv,.json,.tsv"
                      onChange={handleKeyFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={6}
                  value={pasteRawText}
                  onChange={(e) => handlePasteTextChange(e.target.value)}
                  placeholder={`ตัวอย่างเช่น วางข้อสอบทั้งชุด:\n1. ชมพูทวีปคือดินแดนใดในปัจจุบัน\nก. อังกฤษและฝรั่งเศส\nข. เมียนมาและไทย\nค. ปากีสถานและอัฟกานิสถาน\nง. อินเดียและเนปาล\nเฉลย:ง.อินเดียและเนปาล`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                ></textarea>
              </div>

              {/* Live Parsed Preview */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-200">
                    ตัวอย่างผลการวิเคราะห์ดึงเฉลย ({Object.keys(parsedPreviewMap).length} ข้อ)
                  </span>

                  {/* Format Selector inside Modal */}
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-[11px]">
                    <span className="text-slate-400 px-1 font-medium text-[10px]">รูปแบบตัวเลือก:</span>
                    <button
                      type="button"
                      onClick={() => setPastedChoiceFormat('thai')}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all ${pastedChoiceFormat === 'thai' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      ก-ข-ค-ง
                    </button>
                    <button
                      type="button"
                      onClick={() => setPastedChoiceFormat('latin')}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all ${pastedChoiceFormat === 'latin' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      A-B-C-D
                    </button>
                    <button
                      type="button"
                      onClick={() => setPastedChoiceFormat('numeric')}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all ${pastedChoiceFormat === 'numeric' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      1-2-3-4
                    </button>
                  </div>
                </div>

                {Object.keys(parsedPreviewMap).length === 0 ? (
                  <div className="bg-slate-950 border border-dashed border-slate-800 rounded-xl p-4 text-center text-xs text-slate-500">
                    ยังไม่มีข้อมูลเฉลย กรุณาวางข้อความเฉลยในช่องด้านบน
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-44 overflow-y-auto grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 text-xs">
                    {Object.entries(parsedPreviewMap).map(([qNumStr, ans]) => {
                      const qNum = Number(qNumStr);
                      const displayChoice = getChoiceDisplay(String(ans), pastedChoiceFormat);
                      return (
                        <div key={qNum} className="bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-center font-mono">
                          <span className="text-[10px] text-slate-400 block">ข้อ {qNum}</span>
                          <span className="text-emerald-400 font-bold text-xs">{displayChoice}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setPasteRawText('');
                  setParsedPreviewMap({});
                }}
                disabled={!pasteRawText}
                className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg disabled:opacity-40 cursor-pointer"
              >
                ล้างข้อความ
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleApplyPastedKey}
                  disabled={Object.keys(parsedPreviewMap).length === 0}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Check className="w-4 h-4" />
                  นำเข้าและใช้งานเฉลยนี้ ({Object.keys(parsedPreviewMap).length} ข้อ)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
