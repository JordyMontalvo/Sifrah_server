package engine

import (
	"fmt"
	"os"
	"time"
)

type CierreLogger struct {
	RankFile     *os.File
	ResidualFile *os.File
}

func NewCierreLogger() (*CierreLogger, error) {
	dateStr := time.Now().Format("2006-01-02")
	
	rankFileName := fmt.Sprintf("../db/rank_calculation_logs_%s_GO.txt", dateStr)
	residualFileName := fmt.Sprintf("../db/residual_bonus_logs_%s_GO.txt", dateStr)

	rf, err := os.Create(rankFileName)
	if err != nil {
		return nil, err
	}

	resf, err := os.Create(residualFileName)
	if err != nil {
		rf.Close()
		return nil, err
	}

	return &CierreLogger{
		RankFile:     rf,
		ResidualFile: resf,
	}, nil
}

func (l *CierreLogger) LogRank(format string, a ...interface{}) {
	fmt.Fprintf(l.RankFile, format+"\n", a...)
}

func (l *CierreLogger) LogResidual(format string, a ...interface{}) {
	fmt.Fprintf(l.ResidualFile, format+"\n", a...)
}

func (l *CierreLogger) Close() {
	if l.RankFile != nil {
		l.RankFile.Close()
	}
	if l.ResidualFile != nil {
		l.ResidualFile.Close()
	}
}
