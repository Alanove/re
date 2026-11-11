namespace ShippingClientCSharp.PrintLabel
{
    partial class frmPrintLabel
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.btnReset = new System.Windows.Forms.Button();
            this.btnSubmitRequest = new System.Windows.Forms.Button();
            this.gcLabelInfo = new System.Windows.Forms.GroupBox();
            this.rbReportAsFile = new System.Windows.Forms.RadioButton();
            this.rbReportAsURL = new System.Windows.Forms.RadioButton();
            this.lblReportID = new System.Windows.Forms.Label();
            this.nudReportID = new System.Windows.Forms.NumericUpDown();
            this.gcWaybillInformation = new System.Windows.Forms.GroupBox();
            this.lblOrigin = new System.Windows.Forms.Label();
            this.txtOriginEntity = new System.Windows.Forms.TextBox();
            this.lblProductGroup = new System.Windows.Forms.Label();
            this.txtProductGroup = new System.Windows.Forms.TextBox();
            this.lblShipmentNumber = new System.Windows.Forms.Label();
            this.txtShipmentNumber = new System.Windows.Forms.TextBox();
            this.gcTransaction = new System.Windows.Forms.GroupBox();
            this.lblReference5 = new System.Windows.Forms.Label();
            this.lblReference4 = new System.Windows.Forms.Label();
            this.lblReference3 = new System.Windows.Forms.Label();
            this.lblReference2 = new System.Windows.Forms.Label();
            this.lblReference1 = new System.Windows.Forms.Label();
            this.txtReference5 = new System.Windows.Forms.TextBox();
            this.txtReference4 = new System.Windows.Forms.TextBox();
            this.txtReference3 = new System.Windows.Forms.TextBox();
            this.txtReference2 = new System.Windows.Forms.TextBox();
            this.txtReference1 = new System.Windows.Forms.TextBox();
            this.gcClientInfo = new System.Windows.Forms.GroupBox();
            this.lblVersion = new System.Windows.Forms.Label();
            this.lblAccountEntity = new System.Windows.Forms.Label();
            this.lblAccountCountry = new System.Windows.Forms.Label();
            this.lblAccountPin = new System.Windows.Forms.Label();
            this.lblAccountNumber = new System.Windows.Forms.Label();
            this.lblPassword = new System.Windows.Forms.Label();
            this.lblUsername = new System.Windows.Forms.Label();
            this.txtVersion = new System.Windows.Forms.TextBox();
            this.txtAccountEntity = new System.Windows.Forms.TextBox();
            this.txtAccountCountryCode = new System.Windows.Forms.TextBox();
            this.txtAccountPin = new System.Windows.Forms.TextBox();
            this.txtAccountNumber = new System.Windows.Forms.TextBox();
            this.txtPassword = new System.Windows.Forms.TextBox();
            this.txtUsername = new System.Windows.Forms.TextBox();
            this.gcLabelInfo.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.nudReportID)).BeginInit();
            this.gcWaybillInformation.SuspendLayout();
            this.gcTransaction.SuspendLayout();
            this.gcClientInfo.SuspendLayout();
            this.SuspendLayout();
            // 
            // btnReset
            // 
            this.btnReset.Location = new System.Drawing.Point(671, 368);
            this.btnReset.Name = "btnReset";
            this.btnReset.Size = new System.Drawing.Size(134, 23);
            this.btnReset.TabIndex = 12;
            this.btnReset.Text = "Reset";
            this.btnReset.UseVisualStyleBackColor = true;
            this.btnReset.Click += new System.EventHandler(this.btnReset_Click);
            // 
            // btnSubmitRequest
            // 
            this.btnSubmitRequest.Location = new System.Drawing.Point(531, 368);
            this.btnSubmitRequest.Name = "btnSubmitRequest";
            this.btnSubmitRequest.Size = new System.Drawing.Size(134, 23);
            this.btnSubmitRequest.TabIndex = 11;
            this.btnSubmitRequest.Text = "Submit Request";
            this.btnSubmitRequest.UseVisualStyleBackColor = true;
            this.btnSubmitRequest.Click += new System.EventHandler(this.btnSubmitRequest_Click);
            // 
            // gcLabelInfo
            // 
            this.gcLabelInfo.Controls.Add(this.rbReportAsFile);
            this.gcLabelInfo.Controls.Add(this.rbReportAsURL);
            this.gcLabelInfo.Controls.Add(this.lblReportID);
            this.gcLabelInfo.Controls.Add(this.nudReportID);
            this.gcLabelInfo.Location = new System.Drawing.Point(410, 117);
            this.gcLabelInfo.Name = "gcLabelInfo";
            this.gcLabelInfo.Size = new System.Drawing.Size(394, 58);
            this.gcLabelInfo.TabIndex = 10;
            this.gcLabelInfo.TabStop = false;
            this.gcLabelInfo.Text = "Label";
            // 
            // rbReportAsFile
            // 
            this.rbReportAsFile.AutoSize = true;
            this.rbReportAsFile.Location = new System.Drawing.Point(288, 30);
            this.rbReportAsFile.Name = "rbReportAsFile";
            this.rbReportAsFile.Size = new System.Drawing.Size(90, 17);
            this.rbReportAsFile.TabIndex = 3;
            this.rbReportAsFile.TabStop = true;
            this.rbReportAsFile.Text = "Report as File";
            this.rbReportAsFile.UseVisualStyleBackColor = true;
            // 
            // rbReportAsURL
            // 
            this.rbReportAsURL.AutoSize = true;
            this.rbReportAsURL.Location = new System.Drawing.Point(288, 12);
            this.rbReportAsURL.Name = "rbReportAsURL";
            this.rbReportAsURL.Size = new System.Drawing.Size(96, 17);
            this.rbReportAsURL.TabIndex = 2;
            this.rbReportAsURL.TabStop = true;
            this.rbReportAsURL.Text = "Report as URL";
            this.rbReportAsURL.UseVisualStyleBackColor = true;
            // 
            // lblReportID
            // 
            this.lblReportID.AutoSize = true;
            this.lblReportID.Location = new System.Drawing.Point(6, 20);
            this.lblReportID.Name = "lblReportID";
            this.lblReportID.Size = new System.Drawing.Size(56, 13);
            this.lblReportID.TabIndex = 0;
            this.lblReportID.Text = "Report ID:";
            // 
            // nudReportID
            // 
            this.nudReportID.Location = new System.Drawing.Point(68, 16);
            this.nudReportID.Maximum = new decimal(new int[] {
            10000,
            0,
            0,
            0});
            this.nudReportID.Name = "nudReportID";
            this.nudReportID.Size = new System.Drawing.Size(214, 20);
            this.nudReportID.TabIndex = 1;
            this.nudReportID.Value = new decimal(new int[] {
            9201,
            0,
            0,
            0});
            // 
            // gcWaybillInformation
            // 
            this.gcWaybillInformation.Controls.Add(this.lblOrigin);
            this.gcWaybillInformation.Controls.Add(this.txtOriginEntity);
            this.gcWaybillInformation.Controls.Add(this.lblProductGroup);
            this.gcWaybillInformation.Controls.Add(this.txtProductGroup);
            this.gcWaybillInformation.Controls.Add(this.lblShipmentNumber);
            this.gcWaybillInformation.Controls.Add(this.txtShipmentNumber);
            this.gcWaybillInformation.Location = new System.Drawing.Point(411, 11);
            this.gcWaybillInformation.Name = "gcWaybillInformation";
            this.gcWaybillInformation.Size = new System.Drawing.Size(394, 99);
            this.gcWaybillInformation.TabIndex = 9;
            this.gcWaybillInformation.TabStop = false;
            this.gcWaybillInformation.Text = "Waybill";
            // 
            // lblOrigin
            // 
            this.lblOrigin.AutoSize = true;
            this.lblOrigin.Location = new System.Drawing.Point(6, 70);
            this.lblOrigin.Name = "lblOrigin";
            this.lblOrigin.Size = new System.Drawing.Size(37, 13);
            this.lblOrigin.TabIndex = 4;
            this.lblOrigin.Text = "Origin:";
            // 
            // txtOriginEntity
            // 
            this.txtOriginEntity.Location = new System.Drawing.Point(68, 66);
            this.txtOriginEntity.MaxLength = 3;
            this.txtOriginEntity.Name = "txtOriginEntity";
            this.txtOriginEntity.Size = new System.Drawing.Size(310, 20);
            this.txtOriginEntity.TabIndex = 5;
            // 
            // lblProductGroup
            // 
            this.lblProductGroup.Location = new System.Drawing.Point(6, 36);
            this.lblProductGroup.Name = "lblProductGroup";
            this.lblProductGroup.Size = new System.Drawing.Size(44, 30);
            this.lblProductGroup.TabIndex = 2;
            this.lblProductGroup.Text = "Product Group:";
            // 
            // txtProductGroup
            // 
            this.txtProductGroup.Location = new System.Drawing.Point(68, 41);
            this.txtProductGroup.MaxLength = 3;
            this.txtProductGroup.Name = "txtProductGroup";
            this.txtProductGroup.Size = new System.Drawing.Size(310, 20);
            this.txtProductGroup.TabIndex = 3;
            // 
            // lblShipmentNumber
            // 
            this.lblShipmentNumber.AutoSize = true;
            this.lblShipmentNumber.Location = new System.Drawing.Point(6, 19);
            this.lblShipmentNumber.Name = "lblShipmentNumber";
            this.lblShipmentNumber.Size = new System.Drawing.Size(44, 13);
            this.lblShipmentNumber.TabIndex = 0;
            this.lblShipmentNumber.Text = "Waybill:";
            // 
            // txtShipmentNumber
            // 
            this.txtShipmentNumber.Location = new System.Drawing.Point(68, 15);
            this.txtShipmentNumber.MaxLength = 10;
            this.txtShipmentNumber.Name = "txtShipmentNumber";
            this.txtShipmentNumber.Size = new System.Drawing.Size(310, 20);
            this.txtShipmentNumber.TabIndex = 1;
            // 
            // gcTransaction
            // 
            this.gcTransaction.Controls.Add(this.lblReference5);
            this.gcTransaction.Controls.Add(this.lblReference4);
            this.gcTransaction.Controls.Add(this.lblReference3);
            this.gcTransaction.Controls.Add(this.lblReference2);
            this.gcTransaction.Controls.Add(this.lblReference1);
            this.gcTransaction.Controls.Add(this.txtReference5);
            this.gcTransaction.Controls.Add(this.txtReference4);
            this.gcTransaction.Controls.Add(this.txtReference3);
            this.gcTransaction.Controls.Add(this.txtReference2);
            this.gcTransaction.Controls.Add(this.txtReference1);
            this.gcTransaction.Location = new System.Drawing.Point(11, 215);
            this.gcTransaction.Name = "gcTransaction";
            this.gcTransaction.Size = new System.Drawing.Size(394, 147);
            this.gcTransaction.TabIndex = 8;
            this.gcTransaction.TabStop = false;
            this.gcTransaction.Text = "Transaction";
            // 
            // lblReference5
            // 
            this.lblReference5.AutoSize = true;
            this.lblReference5.Location = new System.Drawing.Point(6, 122);
            this.lblReference5.Name = "lblReference5";
            this.lblReference5.Size = new System.Drawing.Size(66, 13);
            this.lblReference5.TabIndex = 8;
            this.lblReference5.Text = "Reference5:";
            // 
            // lblReference4
            // 
            this.lblReference4.AutoSize = true;
            this.lblReference4.Location = new System.Drawing.Point(6, 96);
            this.lblReference4.Name = "lblReference4";
            this.lblReference4.Size = new System.Drawing.Size(66, 13);
            this.lblReference4.TabIndex = 6;
            this.lblReference4.Text = "Reference4:";
            // 
            // lblReference3
            // 
            this.lblReference3.AutoSize = true;
            this.lblReference3.Location = new System.Drawing.Point(6, 70);
            this.lblReference3.Name = "lblReference3";
            this.lblReference3.Size = new System.Drawing.Size(66, 13);
            this.lblReference3.TabIndex = 4;
            this.lblReference3.Text = "Reference3:";
            // 
            // lblReference2
            // 
            this.lblReference2.AutoSize = true;
            this.lblReference2.Location = new System.Drawing.Point(6, 44);
            this.lblReference2.Name = "lblReference2";
            this.lblReference2.Size = new System.Drawing.Size(66, 13);
            this.lblReference2.TabIndex = 2;
            this.lblReference2.Text = "Reference2:";
            // 
            // lblReference1
            // 
            this.lblReference1.AutoSize = true;
            this.lblReference1.Location = new System.Drawing.Point(6, 18);
            this.lblReference1.Name = "lblReference1";
            this.lblReference1.Size = new System.Drawing.Size(66, 13);
            this.lblReference1.TabIndex = 0;
            this.lblReference1.Text = "Reference1:";
            // 
            // txtReference5
            // 
            this.txtReference5.Location = new System.Drawing.Point(78, 118);
            this.txtReference5.Name = "txtReference5";
            this.txtReference5.Size = new System.Drawing.Size(310, 20);
            this.txtReference5.TabIndex = 9;
            // 
            // txtReference4
            // 
            this.txtReference4.Location = new System.Drawing.Point(78, 92);
            this.txtReference4.Name = "txtReference4";
            this.txtReference4.Size = new System.Drawing.Size(310, 20);
            this.txtReference4.TabIndex = 7;
            // 
            // txtReference3
            // 
            this.txtReference3.Location = new System.Drawing.Point(78, 66);
            this.txtReference3.Name = "txtReference3";
            this.txtReference3.Size = new System.Drawing.Size(310, 20);
            this.txtReference3.TabIndex = 5;
            // 
            // txtReference2
            // 
            this.txtReference2.Location = new System.Drawing.Point(78, 40);
            this.txtReference2.Name = "txtReference2";
            this.txtReference2.Size = new System.Drawing.Size(310, 20);
            this.txtReference2.TabIndex = 3;
            // 
            // txtReference1
            // 
            this.txtReference1.Location = new System.Drawing.Point(78, 14);
            this.txtReference1.Name = "txtReference1";
            this.txtReference1.Size = new System.Drawing.Size(310, 20);
            this.txtReference1.TabIndex = 1;
            // 
            // gcClientInfo
            // 
            this.gcClientInfo.Controls.Add(this.lblVersion);
            this.gcClientInfo.Controls.Add(this.lblAccountEntity);
            this.gcClientInfo.Controls.Add(this.lblAccountCountry);
            this.gcClientInfo.Controls.Add(this.lblAccountPin);
            this.gcClientInfo.Controls.Add(this.lblAccountNumber);
            this.gcClientInfo.Controls.Add(this.lblPassword);
            this.gcClientInfo.Controls.Add(this.lblUsername);
            this.gcClientInfo.Controls.Add(this.txtVersion);
            this.gcClientInfo.Controls.Add(this.txtAccountEntity);
            this.gcClientInfo.Controls.Add(this.txtAccountCountryCode);
            this.gcClientInfo.Controls.Add(this.txtAccountPin);
            this.gcClientInfo.Controls.Add(this.txtAccountNumber);
            this.gcClientInfo.Controls.Add(this.txtPassword);
            this.gcClientInfo.Controls.Add(this.txtUsername);
            this.gcClientInfo.Location = new System.Drawing.Point(11, 11);
            this.gcClientInfo.Name = "gcClientInfo";
            this.gcClientInfo.Size = new System.Drawing.Size(394, 198);
            this.gcClientInfo.TabIndex = 7;
            this.gcClientInfo.TabStop = false;
            this.gcClientInfo.Text = "ClientInfo";
            // 
            // lblVersion
            // 
            this.lblVersion.AutoSize = true;
            this.lblVersion.Location = new System.Drawing.Point(6, 174);
            this.lblVersion.Name = "lblVersion";
            this.lblVersion.Size = new System.Drawing.Size(45, 13);
            this.lblVersion.TabIndex = 12;
            this.lblVersion.Text = "Version:";
            // 
            // lblAccountEntity
            // 
            this.lblAccountEntity.AutoSize = true;
            this.lblAccountEntity.Location = new System.Drawing.Point(6, 147);
            this.lblAccountEntity.Name = "lblAccountEntity";
            this.lblAccountEntity.Size = new System.Drawing.Size(61, 13);
            this.lblAccountEntity.TabIndex = 10;
            this.lblAccountEntity.Text = "Acc. Entity:";
            // 
            // lblAccountCountry
            // 
            this.lblAccountCountry.AutoSize = true;
            this.lblAccountCountry.Location = new System.Drawing.Point(6, 122);
            this.lblAccountCountry.Name = "lblAccountCountry";
            this.lblAccountCountry.Size = new System.Drawing.Size(71, 13);
            this.lblAccountCountry.TabIndex = 8;
            this.lblAccountCountry.Text = "Acc. Country:";
            // 
            // lblAccountPin
            // 
            this.lblAccountPin.AutoSize = true;
            this.lblAccountPin.Location = new System.Drawing.Point(6, 96);
            this.lblAccountPin.Name = "lblAccountPin";
            this.lblAccountPin.Size = new System.Drawing.Size(50, 13);
            this.lblAccountPin.TabIndex = 6;
            this.lblAccountPin.Text = "Acc. Pin:";
            // 
            // lblAccountNumber
            // 
            this.lblAccountNumber.AutoSize = true;
            this.lblAccountNumber.Location = new System.Drawing.Point(6, 70);
            this.lblAccountNumber.Name = "lblAccountNumber";
            this.lblAccountNumber.Size = new System.Drawing.Size(52, 13);
            this.lblAccountNumber.TabIndex = 4;
            this.lblAccountNumber.Text = "Acc. No.:";
            // 
            // lblPassword
            // 
            this.lblPassword.AutoSize = true;
            this.lblPassword.Location = new System.Drawing.Point(6, 43);
            this.lblPassword.Name = "lblPassword";
            this.lblPassword.Size = new System.Drawing.Size(56, 13);
            this.lblPassword.TabIndex = 2;
            this.lblPassword.Text = "Password:";
            // 
            // lblUsername
            // 
            this.lblUsername.AutoSize = true;
            this.lblUsername.Location = new System.Drawing.Point(6, 18);
            this.lblUsername.Name = "lblUsername";
            this.lblUsername.Size = new System.Drawing.Size(58, 13);
            this.lblUsername.TabIndex = 0;
            this.lblUsername.Text = "Username:";
            // 
            // txtVersion
            // 
            this.txtVersion.Location = new System.Drawing.Point(78, 170);
            this.txtVersion.Name = "txtVersion";
            this.txtVersion.Size = new System.Drawing.Size(306, 20);
            this.txtVersion.TabIndex = 13;
            this.txtVersion.Text = "1.0";
            // 
            // txtAccountEntity
            // 
            this.txtAccountEntity.Location = new System.Drawing.Point(78, 144);
            this.txtAccountEntity.Name = "txtAccountEntity";
            this.txtAccountEntity.Size = new System.Drawing.Size(306, 20);
            this.txtAccountEntity.TabIndex = 11;
            this.txtAccountEntity.Text = "AMM";
            // 
            // txtAccountCountryCode
            // 
            this.txtAccountCountryCode.Location = new System.Drawing.Point(78, 118);
            this.txtAccountCountryCode.Name = "txtAccountCountryCode";
            this.txtAccountCountryCode.Size = new System.Drawing.Size(306, 20);
            this.txtAccountCountryCode.TabIndex = 9;
            this.txtAccountCountryCode.Text = "JO";
            // 
            // txtAccountPin
            // 
            this.txtAccountPin.Location = new System.Drawing.Point(78, 92);
            this.txtAccountPin.Name = "txtAccountPin";
            this.txtAccountPin.Size = new System.Drawing.Size(306, 20);
            this.txtAccountPin.TabIndex = 7;
            this.txtAccountPin.Text = "221321";
            // 
            // txtAccountNumber
            // 
            this.txtAccountNumber.Location = new System.Drawing.Point(78, 66);
            this.txtAccountNumber.Name = "txtAccountNumber";
            this.txtAccountNumber.Size = new System.Drawing.Size(306, 20);
            this.txtAccountNumber.TabIndex = 5;
            this.txtAccountNumber.Text = "20016";
            // 
            // txtPassword
            // 
            this.txtPassword.Location = new System.Drawing.Point(78, 40);
            this.txtPassword.Name = "txtPassword";
            this.txtPassword.Size = new System.Drawing.Size(306, 20);
            this.txtPassword.TabIndex = 3;
            this.txtPassword.Text = "123456789";
            // 
            // txtUsername
            // 
            this.txtUsername.Location = new System.Drawing.Point(78, 14);
            this.txtUsername.Name = "txtUsername";
            this.txtUsername.Size = new System.Drawing.Size(306, 20);
            this.txtUsername.TabIndex = 1;
            this.txtUsername.Text = "reem@reem.com";
            // 
            // frmPrintLabel
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(817, 402);
            this.Controls.Add(this.btnReset);
            this.Controls.Add(this.btnSubmitRequest);
            this.Controls.Add(this.gcLabelInfo);
            this.Controls.Add(this.gcWaybillInformation);
            this.Controls.Add(this.gcTransaction);
            this.Controls.Add(this.gcClientInfo);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedSingle;
            this.Name = "frmPrintLabel";
            this.ShowInTaskbar = false;
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterParent;
            this.Text = "Shipping API - Shipping Client - Label Printing Service";
            this.Load += new System.EventHandler(this.frmPrintLabel_Load);
            this.gcLabelInfo.ResumeLayout(false);
            this.gcLabelInfo.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.nudReportID)).EndInit();
            this.gcWaybillInformation.ResumeLayout(false);
            this.gcWaybillInformation.PerformLayout();
            this.gcTransaction.ResumeLayout(false);
            this.gcTransaction.PerformLayout();
            this.gcClientInfo.ResumeLayout(false);
            this.gcClientInfo.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        internal System.Windows.Forms.Button btnReset;
        internal System.Windows.Forms.Button btnSubmitRequest;
        internal System.Windows.Forms.GroupBox gcLabelInfo;
        internal System.Windows.Forms.RadioButton rbReportAsFile;
        internal System.Windows.Forms.RadioButton rbReportAsURL;
        internal System.Windows.Forms.Label lblReportID;
        internal System.Windows.Forms.NumericUpDown nudReportID;
        internal System.Windows.Forms.GroupBox gcWaybillInformation;
        internal System.Windows.Forms.Label lblOrigin;
        internal System.Windows.Forms.TextBox txtOriginEntity;
        internal System.Windows.Forms.Label lblProductGroup;
        internal System.Windows.Forms.TextBox txtProductGroup;
        internal System.Windows.Forms.Label lblShipmentNumber;
        internal System.Windows.Forms.TextBox txtShipmentNumber;
        internal System.Windows.Forms.GroupBox gcTransaction;
        internal System.Windows.Forms.Label lblReference5;
        internal System.Windows.Forms.Label lblReference4;
        internal System.Windows.Forms.Label lblReference3;
        internal System.Windows.Forms.Label lblReference2;
        internal System.Windows.Forms.Label lblReference1;
        internal System.Windows.Forms.TextBox txtReference5;
        internal System.Windows.Forms.TextBox txtReference4;
        internal System.Windows.Forms.TextBox txtReference3;
        internal System.Windows.Forms.TextBox txtReference2;
        internal System.Windows.Forms.TextBox txtReference1;
        internal System.Windows.Forms.GroupBox gcClientInfo;
        internal System.Windows.Forms.Label lblVersion;
        internal System.Windows.Forms.Label lblAccountEntity;
        internal System.Windows.Forms.Label lblAccountCountry;
        internal System.Windows.Forms.Label lblAccountPin;
        internal System.Windows.Forms.Label lblAccountNumber;
        internal System.Windows.Forms.Label lblPassword;
        internal System.Windows.Forms.Label lblUsername;
        internal System.Windows.Forms.TextBox txtVersion;
        internal System.Windows.Forms.TextBox txtAccountEntity;
        internal System.Windows.Forms.TextBox txtAccountCountryCode;
        internal System.Windows.Forms.TextBox txtAccountPin;
        internal System.Windows.Forms.TextBox txtAccountNumber;
        internal System.Windows.Forms.TextBox txtPassword;
        internal System.Windows.Forms.TextBox txtUsername;
    }
}